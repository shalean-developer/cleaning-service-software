import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingCleanerRole,
  BookingCleanerRow,
  BookingCleanerStatus,
  Database,
} from "@/lib/database/types";

export type TeamRosterFoundationRow = {
  id: string;
  bookingId: string;
  cleanerId: string;
  cleanerLabel: string | null;
  role: BookingCleanerRole;
  roleLabel: string;
  status: BookingCleanerStatus;
  statusLabel: string;
  assignedByProfileId: string | null;
  /** NF-7F: when support confirmed participation (null for primary / non-support). */
  supportCompletedAt: string | null;
  supportNote: string | null;
  createdAt: string;
  updatedAt: string;
};

const ROLE_LABELS: Record<BookingCleanerRole, string> = {
  primary: "Primary",
  support: "Support",
};

const STATUS_LABELS: Record<BookingCleanerStatus, string> = {
  planned: "Planned",
  offered: "Offered",
  accepted: "Accepted",
  declined: "Declined",
  removed: "Removed",
  completed: "Completed",
};

export function labelForBookingCleanerRole(role: BookingCleanerRole): string {
  return ROLE_LABELS[role];
}

export function labelForBookingCleanerStatus(status: BookingCleanerStatus): string {
  return STATUS_LABELS[status];
}

export async function resolveCleanerLabels(
  client: SupabaseClient<Database> | null,
  cleanerIds: string[],
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (!client || cleanerIds.length === 0) return labels;

  const uniqueIds = [...new Set(cleanerIds)];
  const { data: cleaners } = await client
    .from("cleaners")
    .select("id, profile_id")
    .in("id", uniqueIds);

  const profileIds = (cleaners ?? [])
    .map((c) => c.profile_id)
    .filter((id): id is string => Boolean(id));

  const profileNames = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    for (const p of profiles ?? []) {
      profileNames.set(p.id, p.full_name?.trim() || p.id.slice(0, 8));
    }
  }

  for (const c of cleaners ?? []) {
    const name = profileNames.get(c.profile_id);
    labels.set(c.id, name ?? c.id.slice(0, 8));
  }

  return labels;
}

export function mapBookingCleanerToDisplayRow(
  row: BookingCleanerRow,
  cleanerLabels: Map<string, string>,
): TeamRosterFoundationRow {
  return {
    id: row.id,
    bookingId: row.booking_id,
    cleanerId: row.cleaner_id,
    cleanerLabel: cleanerLabels.get(row.cleaner_id) ?? row.cleaner_id.slice(0, 8),
    role: row.role,
    roleLabel: labelForBookingCleanerRole(row.role),
    status: row.status,
    statusLabel: labelForBookingCleanerStatus(row.status),
    assignedByProfileId: row.assigned_by_profile_id,
    supportCompletedAt: row.support_completed_at ?? null,
    supportNote: row.support_note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Display-only read of NF-7C roster rows. Does not affect dispatch or bookings.cleaner_id.
 */
export async function listTeamRosterFoundationForBooking(
  client: SupabaseClient<Database> | null,
  bookingId: string,
): Promise<TeamRosterFoundationRow[]> {
  if (!client) return [];

  const { data: rows, error } = await client
    .from("booking_cleaners")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error || !rows?.length) return [];

  const sorted = [...rows].sort((a, b) => {
    if (a.role !== b.role) {
      if (a.role === "primary") return -1;
      if (b.role === "primary") return 1;
    }
    return a.created_at.localeCompare(b.created_at);
  });

  const cleanerLabels = await resolveCleanerLabels(
    client,
    sorted.map((r) => r.cleaner_id),
  );

  return sorted.map((row) => mapBookingCleanerToDisplayRow(row, cleanerLabels));
}

/**
 * Optional summary for admin diagnostics when roster rows exist.
 */
export function formatTeamRosterFoundationSummary(rows: TeamRosterFoundationRow[]): string {
  if (rows.length === 0) return "";
  const primary = rows.find((r) => r.role === "primary");
  const supportCount = rows.filter((r) => r.role === "support").length;
  const parts: string[] = [];
  if (primary) {
    parts.push(`Primary: ${primary.cleanerLabel ?? primary.cleanerId.slice(0, 8)} (${primary.statusLabel})`);
  }
  if (supportCount > 0) {
    parts.push(`${supportCount} support`);
  }
  return parts.join(" · ");
}
