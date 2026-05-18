import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isOfferOpenForOps } from "./buildOfferExpiry";
import { listOffersForBooking } from "./offerRepository";

export const DEFERRED_ASSIGNMENT_DISPATCH_BATCH_SIZE = 50;

export type DeferredAssignmentDispatchCandidate = {
  bookingId: string;
  customerId: string;
  assignmentDispatchAt: string;
};

const EXCLUDED_STATUSES = [
  "cancelled",
  "payment_failed",
  "pending_payment",
  "assigned",
  "completed",
  "in_progress",
  "payout_ready",
  "paid_out",
] as const;

/**
 * Confirmed paid bookings whose dispatch window has opened and have no assignment progress.
 */
export async function findDeferredAssignmentDispatchCandidates(
  client: SupabaseClient<Database>,
  options: { now?: Date; batchSize?: number } = {},
): Promise<DeferredAssignmentDispatchCandidate[]> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? DEFERRED_ASSIGNMENT_DISPATCH_BATCH_SIZE;
  const nowIso = now.toISOString();

  const { data: bookings, error } = await client
    .from("bookings")
    .select("id, status, customer_id, cleaner_id, assignment_dispatch_at")
    .eq("status", "confirmed")
    .not("assignment_dispatch_at", "is", null)
    .lte("assignment_dispatch_at", nowIso)
    .order("assignment_dispatch_at", { ascending: true })
    .limit(batchSize * 2);

  if (error) throw new Error(error.message);

  const candidates: DeferredAssignmentDispatchCandidate[] = [];

  for (const booking of bookings ?? []) {
    if (candidates.length >= batchSize) break;
    if (EXCLUDED_STATUSES.includes(booking.status as (typeof EXCLUDED_STATUSES)[number])) {
      continue;
    }
    if (booking.cleaner_id) continue;
    if (!booking.assignment_dispatch_at) continue;

    const { count: paidCount, error: payErr } = await client
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", booking.id)
      .eq("status", "paid");
    if (payErr) throw new Error(payErr.message);
    if ((paidCount ?? 0) === 0) continue;

    const offers = await listOffersForBooking(client, booking.id);
    if (offers.some((o) => o.status === "accepted")) continue;
    if (offers.some((o) => isOfferOpenForOps(o, now))) continue;

    candidates.push({
      bookingId: booking.id,
      customerId: booking.customer_id,
      assignmentDispatchAt: booking.assignment_dispatch_at,
    });
  }

  return candidates;
}
