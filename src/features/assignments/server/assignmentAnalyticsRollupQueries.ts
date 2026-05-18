import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import type { OfferMetricsInput } from "./assignmentMetricsAggregate";

export { buildAssignmentAnalyticsPathByBookingId } from "./resolveAssignmentAnalyticsPath";

export const OFFER_METRICS_SELECT = "booking_id, status, offered_at, responded_at, updated_at";

const ADMIN_INTERVENTION_ACTIONS = [
  "manual_dispatch_offer",
  "replace_open_offer",
  "assignment_recovery",
] as const;

export async function fetchOffersCreatedInBucket(
  client: SupabaseClient<Database>,
  bucketStartIso: string,
  bucketEndIso: string,
): Promise<OfferMetricsInput[]> {
  const { data, error } = await client
    .from("assignment_offers")
    .select(OFFER_METRICS_SELECT)
    .gte("offered_at", bucketStartIso)
    .lt("offered_at", bucketEndIso);

  if (error) throw new Error(error.message);
  return (data ?? []) as OfferMetricsInput[];
}

export async function fetchOffersForBookings(
  client: SupabaseClient<Database>,
  bookingIds: string[],
  beforeIso: string,
): Promise<OfferMetricsInput[]> {
  if (bookingIds.length === 0) return [];

  const { data, error } = await client
    .from("assignment_offers")
    .select(OFFER_METRICS_SELECT)
    .in("booking_id", bookingIds)
    .lt("offered_at", beforeIso);

  if (error) throw new Error(error.message);
  return (data ?? []) as OfferMetricsInput[];
}

export async function fetchTerminalOffersInBucket(
  client: SupabaseClient<Database>,
  bucketStartIso: string,
  bucketEndIso: string,
): Promise<OfferMetricsInput[]> {
  const { data: responded, error: respondedError } = await client
    .from("assignment_offers")
    .select(OFFER_METRICS_SELECT)
    .in("status", ["accepted", "declined", "cancelled"])
    .gte("responded_at", bucketStartIso)
    .lt("responded_at", bucketEndIso);

  if (respondedError) throw new Error(respondedError.message);

  const { data: expired, error: expiredError } = await client
    .from("assignment_offers")
    .select(OFFER_METRICS_SELECT)
    .eq("status", "expired")
    .gte("updated_at", bucketStartIso)
    .lt("updated_at", bucketEndIso);

  if (expiredError) throw new Error(expiredError.message);

  const merged = new Map<string, OfferMetricsInput>();
  for (const row of [...((responded ?? []) as OfferMetricsInput[]), ...((expired ?? []) as OfferMetricsInput[])]) {
    merged.set(`${row.booking_id}:${row.offered_at}:${row.status}`, row);
  }
  return [...merged.values()];
}

export type BookingAuditTimestampRow = {
  booking_id: string;
  created_at: string;
};

export async function fetchAssignedBookingIdsInBucket(
  client: SupabaseClient<Database>,
  bucketStartIso: string,
  bucketEndIso: string,
): Promise<string[]> {
  const rows = await fetchAcceptAssignmentAuditsInBucket(client, bucketStartIso, bucketEndIso);
  return rows.map((row) => row.booking_id);
}

export async function fetchAcceptAssignmentAuditsInBucket(
  client: SupabaseClient<Database>,
  bucketStartIso: string,
  bucketEndIso: string,
): Promise<BookingAuditTimestampRow[]> {
  const { data, error } = await client
    .from("booking_state_audit")
    .select("booking_id, created_at")
    .eq("command", "ACCEPT_CLEANER_ASSIGNMENT")
    .gte("created_at", bucketStartIso)
    .lt("created_at", bucketEndIso);

  if (error) throw new Error(error.message);
  return (data ?? []) as BookingAuditTimestampRow[];
}

export async function fetchFirstPendingAssignmentAuditByBookingIds(
  client: SupabaseClient<Database>,
  bookingIds: string[],
): Promise<Map<string, string>> {
  if (bookingIds.length === 0) return new Map();

  const { data, error } = await client
    .from("booking_state_audit")
    .select("booking_id, created_at")
    .eq("command", "MOVE_TO_PENDING_ASSIGNMENT")
    .in("booking_id", bookingIds);

  if (error) throw new Error(error.message);

  const pendingByBookingId = new Map<string, string>();
  for (const row of (data ?? []) as BookingAuditTimestampRow[]) {
    const existing = pendingByBookingId.get(row.booking_id);
    if (!existing || row.created_at < existing) {
      pendingByBookingId.set(row.booking_id, row.created_at);
    }
  }

  return pendingByBookingId;
}

export async function fetchAdminInterventionCountInBucket(
  client: SupabaseClient<Database>,
  bucketStartIso: string,
  bucketEndIso: string,
): Promise<number> {
  const { count, error } = await client
    .from("admin_operational_audit")
    .select("id", { count: "exact", head: true })
    .in("action", [...ADMIN_INTERVENTION_ACTIONS])
    .in("outcome", ["success", "idempotent"])
    .gte("created_at", bucketStartIso)
    .lt("created_at", bucketEndIso);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
