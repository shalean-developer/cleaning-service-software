import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, BookingRow } from "@/lib/database/types";
import { isMockCleanerIdentity } from "@/lib/ops/mockCleanerPatterns";
import type { CleanerCandidateRecord } from "./types";
import { BOOKING_CONFLICT_STATUSES } from "./eligibility/evaluate";

export async function loadCleanerCandidates(
  client: SupabaseClient<Database>,
): Promise<CleanerCandidateRecord[]> {
  const { data: cleaners, error } = await client
    .from("cleaners")
    .select(
      "id, profile_id, phone, active, suspended_at, average_rating, created_at, deleted_at, onboarding_completed_at",
    );

  if (error) throw new Error(error.message);
  if (!cleaners?.length) return [];

  const profileIds = [...new Set(cleaners.map((c) => c.profile_id))];
  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id, full_name")
    .in("id", profileIds);

  if (profileError) throw new Error(profileError.message);

  const displayNameByProfile = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || "Cleaner"]),
  );

  const ids = cleaners.map((c) => c.id);

  const [areasRes, capsRes, availRes, offRes] = await Promise.all([
    client.from("cleaner_service_areas").select("cleaner_id, area_slug").in("cleaner_id", ids),
    client
      .from("cleaner_service_capabilities")
      .select("cleaner_id, service_slug")
      .in("cleaner_id", ids),
    client
      .from("cleaner_availability")
      .select("cleaner_id, day_of_week, start_time, end_time, timezone")
      .in("cleaner_id", ids),
    client.from("cleaner_time_off").select("cleaner_id, start_at, end_at").in("cleaner_id", ids),
  ]);

  if (areasRes.error) throw new Error(areasRes.error.message);
  if (capsRes.error) throw new Error(capsRes.error.message);
  if (availRes.error) throw new Error(availRes.error.message);
  if (offRes.error) throw new Error(offRes.error.message);

  const areasByCleaner = groupBy(areasRes.data ?? [], "cleaner_id");
  const capsByCleaner = groupBy(capsRes.data ?? [], "cleaner_id");
  const availByCleaner = groupBy(availRes.data ?? [], "cleaner_id");
  const offByCleaner = groupBy(offRes.data ?? [], "cleaner_id");

  const candidates = cleaners
    .filter((row) => row.deleted_at == null)
    .filter(
      (row) =>
        !isMockCleanerIdentity({
          fullName: displayNameByProfile.get(row.profile_id) ?? null,
          phone: row.phone,
        }),
    )
    .map((row) => ({
    cleanerId: row.id,
    profileId: row.profile_id,
    phone: row.phone,
    displayName: displayNameByProfile.get(row.profile_id) ?? "Cleaner",
    active: row.active,
    suspendedAt: row.suspended_at,
    deletedAt: row.deleted_at,
    onboardingCompletedAt: row.onboarding_completed_at,
    averageRating: row.average_rating,
    hiredAt: row.created_at,
    serviceAreas: (areasByCleaner[row.id] ?? []).map((a) => a.area_slug as string),
    serviceSlugs: (capsByCleaner[row.id] ?? []).map((c) => c.service_slug as string),
    availabilityWindows: (availByCleaner[row.id] ?? []).map((a) => ({
      dayOfWeek: a.day_of_week as number,
      startTime: String(a.start_time),
      endTime: String(a.end_time),
      timezone: (a.timezone as string) || "Africa/Johannesburg",
    })),
    timeOffBlocks: (offByCleaner[row.id] ?? []).map((t) => ({
      startAt: t.start_at as string,
      endAt: t.end_at as string,
    })),
  }));

  return candidates;
}

export async function loadConflictingCleanerIds(
  client: SupabaseClient<Database>,
  scheduledStart: string,
  scheduledEnd: string,
  excludeBookingId?: string | null,
): Promise<Set<string>> {
  const { data, error } = await client
    .from("bookings")
    .select("id, cleaner_id, scheduled_start, scheduled_end, status")
    .not("cleaner_id", "is", null)
    .in("status", [...BOOKING_CONFLICT_STATUSES])
    .lt("scheduled_start", scheduledEnd)
    .gt("scheduled_end", scheduledStart);

  if (error) throw new Error(error.message);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (!row.cleaner_id) continue;
    if (excludeBookingId && row.id === excludeBookingId) continue;
    ids.add(row.cleaner_id);
  }
  return ids;
}

export async function getBookingForCustomer(
  client: SupabaseClient<Database>,
  bookingId: string,
  customerId: string,
): Promise<BookingRow | null> {
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

function groupBy<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const row of rows) {
    const id = String(row[key]);
    if (!out[id]) out[id] = [];
    out[id].push(row);
  }
  return out;
}
