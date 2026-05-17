import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { Database } from "@/lib/database/types";
import { ASSIGNMENT_RECOVERY_GRACE_MINUTES } from "./constants";
import { findAssignmentRecoveryCandidates } from "./findAssignmentRecoveryCandidates";
import { isAssignmentRecoveryCandidate } from "./isAssignmentRecoveryCandidate";
import { listOffersForBooking } from "./offerRepository";
import { runAssignmentAfterPayment } from "./runAssignmentAfterPayment";
import type { RunAssignmentResult } from "./types";

export type AssignmentRecoveryFailure = {
  bookingId: string;
  code: string;
  message: string;
};

export type AssignmentRecoveryRunResult = {
  candidateCount: number;
  attemptedCount: number;
  recoveredBookingIds: string[];
  skippedBookingIds: string[];
  failed: AssignmentRecoveryFailure[];
};

async function stillRecoveryCandidate(
  client: SupabaseClient<Database>,
  bookingId: string,
  paymentId: string,
  now: Date,
  graceMinutes: number,
): Promise<boolean> {
  const { data: booking, error: bookErr } = await client
    .from("bookings")
    .select("id, status, cleaner_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookErr) throw new Error(bookErr.message);
  if (!booking) return false;

  const { data: payment, error: payErr } = await client
    .from("payments")
    .select("id, status, updated_at, created_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (payErr) throw new Error(payErr.message);

  const offers = await listOffersForBooking(client, bookingId);
  return isAssignmentRecoveryCandidate({
    booking,
    payments: payment ? [payment] : [],
    offers,
    now,
    graceMinutes,
  });
}

export async function recoverAssignmentForBooking(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  bookingId: string,
): Promise<RunAssignmentResult> {
  return runAssignmentAfterPayment(client, backend, bookingId);
}

export async function runAssignmentRecoveryBatch(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  options: {
    now?: Date;
    graceMinutes?: number;
    batchSize?: number;
  } = {},
): Promise<AssignmentRecoveryRunResult> {
  const now = options.now ?? new Date();
  const candidates = await findAssignmentRecoveryCandidates(client, options);

  const recoveredBookingIds: string[] = [];
  const skippedBookingIds: string[] = [];
  const failed: AssignmentRecoveryFailure[] = [];
  let attemptedCount = 0;

  const graceMinutes = options.graceMinutes ?? ASSIGNMENT_RECOVERY_GRACE_MINUTES;

  for (const candidate of candidates) {
    const eligible = await stillRecoveryCandidate(
      client,
      candidate.bookingId,
      candidate.paymentId,
      now,
      graceMinutes,
    );
    if (!eligible) {
      skippedBookingIds.push(candidate.bookingId);
      continue;
    }

    attemptedCount += 1;
    const result = await recoverAssignmentForBooking(
      client,
      backend,
      candidate.bookingId,
    );

    if (result.ok) {
      const booking = await backend.getBooking(candidate.bookingId);
      if (booking?.status === "confirmed") {
        failed.push({
          bookingId: candidate.bookingId,
          code: "STILL_CONFIRMED",
          message: `Recovery ran but booking remained confirmed (outcome=${result.outcome}).`,
        });
      } else {
        recoveredBookingIds.push(candidate.bookingId);
      }
    } else {
      failed.push({
        bookingId: candidate.bookingId,
        code: result.code,
        message: result.message,
      });
    }
  }

  return {
    candidateCount: candidates.length,
    attemptedCount,
    recoveredBookingIds,
    skippedBookingIds,
    failed,
  };
}
