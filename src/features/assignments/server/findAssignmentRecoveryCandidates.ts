import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  ASSIGNMENT_RECOVERY_BATCH_SIZE,
  ASSIGNMENT_RECOVERY_GRACE_MINUTES,
} from "./constants";
import { isAssignmentRecoveryCandidate } from "./isAssignmentRecoveryCandidate";
import { listOffersForBooking } from "./offerRepository";

export type AssignmentRecoveryCandidate = {
  bookingId: string;
  customerId: string;
  paymentId: string;
  paidAt: string;
};

export async function findAssignmentRecoveryCandidates(
  client: SupabaseClient<Database>,
  options: {
    now?: Date;
    graceMinutes?: number;
    batchSize?: number;
  } = {},
): Promise<AssignmentRecoveryCandidate[]> {
  const now = options.now ?? new Date();
  const graceMinutes = options.graceMinutes ?? ASSIGNMENT_RECOVERY_GRACE_MINUTES;
  const batchSize = options.batchSize ?? ASSIGNMENT_RECOVERY_BATCH_SIZE;
  const graceCutoffIso = new Date(now.getTime() - graceMinutes * 60_000).toISOString();

  const { data: payments, error: payErr } = await client
    .from("payments")
    .select("id, booking_id, status, updated_at, created_at")
    .eq("status", "paid")
    .lte("updated_at", graceCutoffIso)
    .order("updated_at", { ascending: true })
    .limit(batchSize * 4);

  if (payErr) throw new Error(payErr.message);

  const byBooking = new Map<string, (typeof payments)[number]>();
  for (const payment of payments ?? []) {
    if (!byBooking.has(payment.booking_id)) {
      byBooking.set(payment.booking_id, payment);
    }
  }

  const candidates: AssignmentRecoveryCandidate[] = [];

  for (const payment of byBooking.values()) {
    if (candidates.length >= batchSize) break;

    const { data: booking, error: bookErr } = await client
      .from("bookings")
      .select("id, status, customer_id, cleaner_id, assignment_dispatch_at")
      .eq("id", payment.booking_id)
      .maybeSingle();

    if (bookErr) throw new Error(bookErr.message);
    if (!booking) continue;

    const offers = await listOffersForBooking(client, booking.id);

    if (
      !isAssignmentRecoveryCandidate({
        booking,
        payments: [payment],
        offers,
        now,
        graceMinutes,
      })
    ) {
      continue;
    }

    candidates.push({
      bookingId: booking.id,
      customerId: booking.customer_id,
      paymentId: payment.id,
      paidAt: payment.updated_at || payment.created_at,
    });
  }

  return candidates;
}
