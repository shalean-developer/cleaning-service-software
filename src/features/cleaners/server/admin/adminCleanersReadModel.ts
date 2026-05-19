import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { listOffersForCleaner } from "@/features/assignments/server/offerRepository";
import { resolveCleanerEmailOrNull } from "@/features/notifications/server/resolveCleanerEmail";
import type {
  CleanerOperationalAuditRow,
  CleanerRow,
  ProfileRow,
} from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCleanerSuspended } from "../eligibility/evaluate";
import {
  countActiveBookingsForCleaner,
  countOpenOffersForCleaner,
  countPendingEarningsForCleaner,
} from "../lifecycle/lifecycleQueries";
import {
  resolveCleanerOperationalState,
  type CleanerLifecycleSnapshot,
  type CleanerOperationalState,
} from "../lifecycle/operationalState";
import type { ServiceSlug } from "@/features/pricing/server/types";
import {
  availabilityRowsToFormValues,
  formatCleanerAvailabilitySummary,
} from "@/features/cleaners/admin/cleanerAvailability";
import { buildShaleanCleanerAuthEmail } from "@/lib/auth/cleanerAuthIdentity";
import type {
  AdminCleanerDetail,
  AdminCleanerLastLifecycleAction,
  AdminCleanerListItem,
  AdminCleanerOperationalFilter,
  AdminCleanersListResult,
  AdminCleanerSafetyCounts,
} from "./types";

const ADMIN_CLEANERS_LIST_LIMIT = 200;
const ADMIN_CLEANER_AUDIT_LIMIT = 50;
const ADMIN_CLEANER_ACTIVE_BOOKINGS_LIMIT = 20;

const VALID_FILTERS = new Set<AdminCleanerOperationalFilter>([
  "all",
  "active",
  "onboarding",
  "inactive",
  "suspended",
  "archived",
]);

function lifecycleSnapshot(row: CleanerRow): CleanerLifecycleSnapshot {
  return {
    active: row.active,
    suspendedAt: row.suspended_at,
    deletedAt: row.deleted_at,
    onboardingCompletedAt: row.onboarding_completed_at,
  };
}

function displayName(profile: Pick<ProfileRow, "full_name"> | null, cleanerId: string): string {
  const name = profile?.full_name?.trim();
  return name || `Cleaner ${cleanerId.slice(0, 8)}`;
}

async function loadSafetyCounts(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  cleanerId: string,
): Promise<AdminCleanerSafetyCounts> {
  const [openOffersCount, activeBookingsCount, pendingEarningsCount] = await Promise.all([
    countOpenOffersForCleaner(client, cleanerId),
    countActiveBookingsForCleaner(client, cleanerId),
    countPendingEarningsForCleaner(client, cleanerId),
  ]);
  return { openOffersCount, activeBookingsCount, pendingEarningsCount };
}

function mapLastLifecycleAction(
  row: Pick<CleanerOperationalAuditRow, "action" | "outcome" | "created_at">,
): AdminCleanerLastLifecycleAction {
  return {
    action: row.action,
    outcome: row.outcome,
    createdAt: row.created_at,
  };
}

async function buildLatestLifecycleActionMap(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  cleanerIds: string[],
): Promise<Map<string, AdminCleanerLastLifecycleAction>> {
  const map = new Map<string, AdminCleanerLastLifecycleAction>();
  if (cleanerIds.length === 0) return map;

  const { data, error } = await client
    .from("cleaner_operational_audit")
    .select("cleaner_id, action, outcome, created_at")
    .in("cleaner_id", cleanerIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    if (!map.has(row.cleaner_id)) {
      map.set(row.cleaner_id, mapLastLifecycleAction(row));
    }
  }
  return map;
}

export function normalizeAdminCleanerFilter(
  filterParam: string | undefined,
): AdminCleanerOperationalFilter {
  if (filterParam && VALID_FILTERS.has(filterParam as AdminCleanerOperationalFilter)) {
    return filterParam as AdminCleanerOperationalFilter;
  }
  return "all";
}

export function matchesOperationalFilter(
  state: CleanerOperationalState,
  filter: AdminCleanerOperationalFilter,
): boolean {
  if (filter === "all") return true;
  return state === filter;
}

export async function listAdminCleaners(
  user: CurrentUser,
  filter: AdminCleanerOperationalFilter = "all",
): Promise<
  | { ok: true } & AdminCleanersListResult
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase not configured.",
      status: 503,
    };
  }

  const { data: cleaners, error } = await client
    .from("cleaners")
    .select(
      "id, profile_id, phone, active, suspended_at, deleted_at, onboarding_completed_at, suspension_ends_at, lifecycle_reason, average_rating, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(ADMIN_CLEANERS_LIST_LIMIT);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  const rows = (cleaners ?? []) as CleanerRow[];
  const profileIds = [...new Set(rows.map((r) => r.profile_id))];
  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("id, full_name")
    .in("id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profilesError) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: profilesError.message, status: 500 };
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const lifecycleMap = await buildLatestLifecycleActionMap(
    client,
    rows.map((r) => r.id),
  );

  const items: AdminCleanerListItem[] = [];

  for (const row of rows) {
    const operationalState = resolveCleanerOperationalState(lifecycleSnapshot(row));
    if (!matchesOperationalFilter(operationalState, filter)) continue;

    const profile = profileById.get(row.profile_id) ?? null;
    const safetyCounts = await loadSafetyCounts(client, row.id);

    const listItem: AdminCleanerListItem = {
      id: row.id,
      name: displayName(profile, row.id),
      email: null,
      phone: row.phone,
      operationalState,
      active: row.active,
      isSuspended: isCleanerSuspended(row.suspended_at),
      openOffersCount: safetyCounts.openOffersCount,
      activeBookingsCount: safetyCounts.activeBookingsCount,
      pendingEarningsCount: safetyCounts.pendingEarningsCount,
      lastLifecycleAction: lifecycleMap.get(row.id) ?? null,
    };
    items.push(listItem);
  }

  await Promise.all(
    items.map(async (item) => {
      item.email = await resolveCleanerEmailOrNull(item.id);
    }),
  );

  return {
    ok: true,
    items,
    filter,
    totalCount: items.length,
  };
}

export async function getAdminCleanerDetail(
  user: CurrentUser,
  cleanerId: string,
): Promise<
  | { ok: true; detail: AdminCleanerDetail }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase not configured.",
      status: 503,
    };
  }

  const { data: row, error } = await client
    .from("cleaners")
    .select(
      "id, profile_id, phone, active, suspended_at, deleted_at, onboarding_completed_at, suspension_ends_at, lifecycle_reason, average_rating, created_at, updated_at",
    )
    .eq("id", cleanerId)
    .maybeSingle();

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }
  if (!row) {
    return { ok: false, code: "CLEANER_NOT_FOUND", message: "Cleaner not found.", status: 404 };
  }

  const cleaner = row as CleanerRow;

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, full_name")
    .eq("id", cleaner.profile_id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: profileError.message, status: 500 };
  }

  const [safetyCounts, auditResult, openOffers, email, capsResult, areasResult, availResult] =
    await Promise.all([
      loadSafetyCounts(client, cleaner.id),
      client
        .from("cleaner_operational_audit")
        .select("*")
        .eq("cleaner_id", cleaner.id)
        .order("created_at", { ascending: false })
        .limit(ADMIN_CLEANER_AUDIT_LIMIT),
      listOffersForCleaner(client, cleaner.id, ["offered"]),
      resolveCleanerEmailOrNull(cleaner.id),
      client
        .from("cleaner_service_capabilities")
        .select("service_slug")
        .eq("cleaner_id", cleaner.id),
      client.from("cleaner_service_areas").select("area_slug").eq("cleaner_id", cleaner.id),
      client
        .from("cleaner_availability")
        .select("day_of_week, start_time, end_time, timezone")
        .eq("cleaner_id", cleaner.id),
    ]);

  if (capsResult.error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: capsResult.error.message, status: 500 };
  }
  if (areasResult.error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: areasResult.error.message, status: 500 };
  }
  if (availResult.error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: availResult.error.message, status: 500 };
  }

  const capabilities = (capsResult.data ?? []).map((row) => row.service_slug as ServiceSlug);
  const serviceAreaSlugs = (areasResult.data ?? []).map((row) => row.area_slug as string);
  const availabilityRows = availResult.data ?? [];
  const availability = availabilityRowsToFormValues(availabilityRows);
  const availabilitySummary = formatCleanerAvailabilitySummary(availabilityRows);
  const loginEmail = cleaner.phone ? buildShaleanCleanerAuthEmail(cleaner.phone) : null;

  if (auditResult.error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: auditResult.error.message, status: 500 };
  }

  const activeStatuses = ["assigned", "in_progress"] as const;
  const { data: leadBookings } = await client
    .from("bookings")
    .select("id")
    .eq("cleaner_id", cleaner.id)
    .in("status", [...activeStatuses])
    .order("scheduled_start", { ascending: true })
    .limit(ADMIN_CLEANER_ACTIVE_BOOKINGS_LIMIT);

  const { data: rosterRows } = await client
    .from("booking_cleaners")
    .select("booking_id")
    .eq("cleaner_id", cleaner.id);

  const rosterBookingIds = (rosterRows ?? []).map((r) => r.booking_id);
  let rosterActiveIds: string[] = [];
  if (rosterBookingIds.length > 0) {
    const { data: rosterBookings } = await client
      .from("bookings")
      .select("id")
      .in("id", rosterBookingIds)
      .in("status", [...activeStatuses])
      .limit(ADMIN_CLEANER_ACTIVE_BOOKINGS_LIMIT);
    rosterActiveIds = (rosterBookings ?? []).map((b) => b.id);
  }

  const activeBookingIds = [
    ...new Set([
      ...(leadBookings ?? []).map((b) => b.id),
      ...rosterActiveIds,
    ]),
  ].slice(0, ADMIN_CLEANER_ACTIVE_BOOKINGS_LIMIT);

  const operationalState = resolveCleanerOperationalState(lifecycleSnapshot(cleaner));

  return {
    ok: true,
    detail: {
      id: cleaner.id,
      profileId: cleaner.profile_id,
      name: displayName(profile, cleaner.id),
      email,
      loginEmail,
      phone: cleaner.phone,
      capabilities,
      serviceAreaSlugs,
      availability,
      availabilitySummary,
      operationalState,
      active: cleaner.active,
      suspendedAt: cleaner.suspended_at,
      suspensionEndsAt: cleaner.suspension_ends_at,
      deletedAt: cleaner.deleted_at,
      onboardingCompletedAt: cleaner.onboarding_completed_at,
      lifecycleReason: cleaner.lifecycle_reason,
      averageRating: cleaner.average_rating,
      createdAt: cleaner.created_at,
      updatedAt: cleaner.updated_at,
      safetyCounts,
      auditLog: (auditResult.data ?? []) as CleanerOperationalAuditRow[],
      openOffers,
      activeBookingIds,
    },
  };
}
