import type { SupabaseClient } from "@supabase/supabase-js";
import type { CleanerPreferenceLock } from "@/features/bookings/server/lock/types";
import { findLockByBookingId } from "@/features/bookings/server/lock/lockRepository";
import type { Json } from "@/lib/database/types";
import type { Database } from "@/lib/database/types";
import { readAssignmentMetadata } from "./assignmentMetadata";
import type { AssignmentPath } from "./types";

/** Analytics path families for 7B-1b-min rollups and admin DTOs. */
export type AssignmentAnalyticsPath =
  | "selected"
  | "best_available"
  | "admin_manual"
  | "unknown";

export const ASSIGNMENT_ANALYTICS_PATHS: readonly AssignmentAnalyticsPath[] = [
  "selected",
  "best_available",
  "admin_manual",
  "unknown",
] as const;

export function mapEnginePathToAnalyticsPath(path: AssignmentPath): AssignmentAnalyticsPath {
  switch (path) {
    case "selected":
      return "selected";
    case "best_available":
    case "fallback_best_available":
      return "best_available";
    case "admin_manual":
      return "admin_manual";
    default:
      return "unknown";
  }
}

/**
 * Resolve analytics path from booking metadata and optional lock preference.
 * Does not mutate metadata.
 */
export function resolveAssignmentAnalyticsPathFromSignals(
  metadata: Json | null | undefined,
  lockPreference?: CleanerPreferenceLock | null,
): AssignmentAnalyticsPath {
  const meta = readAssignmentMetadata(metadata);
  if (meta?.path) {
    return mapEnginePathToAnalyticsPath(meta.path);
  }

  if (lockPreference?.mode === "selected") {
    return "selected";
  }
  if (lockPreference?.mode === "best_available") {
    return "best_available";
  }

  if (metadata != null && typeof metadata === "object" && !Array.isArray(metadata)) {
    const record = metadata as Record<string, unknown>;
    if (record.cleanerPreferenceMode === "selected") {
      return "selected";
    }
    if (record.cleanerPreferenceMode === "best_available") {
      return "best_available";
    }
  }

  return "unknown";
}

/**
 * Read-only path resolver for assignment analytics (rollup + live metrics).
 */
export async function resolveAssignmentAnalyticsPathForBooking(
  client: SupabaseClient<Database>,
  booking: { id: string; metadata: Json | null },
  lockPreference?: CleanerPreferenceLock | null,
): Promise<AssignmentAnalyticsPath> {
  const meta = readAssignmentMetadata(booking.metadata);
  if (meta?.path) {
    return mapEnginePathToAnalyticsPath(meta.path);
  }

  const pref =
    lockPreference ??
    ((await findLockByBookingId(client, booking.id))
      ?.locked_cleaner_preference as CleanerPreferenceLock | undefined) ??
    null;

  return resolveAssignmentAnalyticsPathFromSignals(booking.metadata, pref);
}

/** Batch path resolution for rollup and live analytics (read-only). */
export async function buildAssignmentAnalyticsPathByBookingId(
  client: SupabaseClient<Database>,
  bookingIds: readonly string[],
): Promise<Map<string, AssignmentAnalyticsPath>> {
  const unique = [...new Set(bookingIds)];
  const map = new Map<string, AssignmentAnalyticsPath>();
  if (unique.length === 0) return map;

  const { data: bookings, error: bookingsError } = await client
    .from("bookings")
    .select("id, metadata")
    .in("id", unique);

  if (bookingsError) throw new Error(bookingsError.message);

  const { data: locks, error: locksError } = await client
    .from("booking_locks")
    .select("booking_id, locked_cleaner_preference")
    .in("booking_id", unique)
    .eq("status", "active");

  if (locksError) throw new Error(locksError.message);

  const lockByBooking = new Map<string, CleanerPreferenceLock>();
  for (const row of locks ?? []) {
    if (row.booking_id) {
      lockByBooking.set(row.booking_id, row.locked_cleaner_preference as CleanerPreferenceLock);
    }
  }

  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));

  for (const id of unique) {
    const booking = bookingById.get(id);
    const lockPreference = lockByBooking.get(id) ?? null;
    map.set(
      id,
      resolveAssignmentAnalyticsPathFromSignals(booking?.metadata ?? null, lockPreference),
    );
  }

  return map;
}
