import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { Database } from "@/lib/database/types";
import {
  findDeferredAssignmentDispatchCandidates,
  DEFERRED_ASSIGNMENT_DISPATCH_BATCH_SIZE,
} from "./findDeferredAssignmentDispatchCandidates";
import { isOfferOpenForOps } from "./buildOfferExpiry";
import { listOffersForBooking } from "./offerRepository";
import { runAssignmentAfterPayment } from "./runAssignmentAfterPayment";
import { shouldRunAssignmentNow } from "./computeAssignmentDispatchAt";
import {
  logDeferredDispatchBookingAttempt,
  logDeferredDispatchCronRun,
} from "./logDeferredAssignmentDispatch";
import { resolveDeferredDispatchStatus } from "./deferredDispatchStatus";

export type DeferredAssignmentDispatchFailure = {
  bookingId: string;
  code: string;
  message: string;
};

export type DeferredAssignmentDispatchBatchResult = {
  candidateCount: number;
  attemptedCount: number;
  dispatchedBookingIds: string[];
  skippedBookingIds: string[];
  failed: DeferredAssignmentDispatchFailure[];
};

async function stillDeferredDispatchCandidate(
  client: SupabaseClient<Database>,
  bookingId: string,
  now: Date,
): Promise<boolean> {
  const { data: booking, error: bookErr } = await client
    .from("bookings")
    .select("id, status, cleaner_id, assignment_dispatch_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookErr) throw new Error(bookErr.message);
  if (!booking || booking.status !== "confirmed" || booking.cleaner_id) return false;
  if (!shouldRunAssignmentNow(booking.assignment_dispatch_at, now)) return false;

  const offers = await listOffersForBooking(client, bookingId);
  if (offers.some((o) => o.status === "accepted")) return false;
  if (offers.some((o) => isOfferOpenForOps(o, now))) return false;

  const { count, error: payErr } = await client
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("status", "paid");
  if (payErr) throw new Error(payErr.message);
  return (count ?? 0) > 0;
}

export async function runDeferredAssignmentDispatchBatch(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  options: {
    now?: Date;
    batchSize?: number;
    /** When false, skips aggregate cron log (for tests). */
    logCronSummary?: boolean;
  } = {},
): Promise<DeferredAssignmentDispatchBatchResult> {
  const startedAt = Date.now();
  const ranAt = new Date().toISOString();
  const now = options.now ?? new Date();
  const candidates = await findDeferredAssignmentDispatchCandidates(client, {
    now,
    batchSize: options.batchSize ?? DEFERRED_ASSIGNMENT_DISPATCH_BATCH_SIZE,
  });

  const dispatchedBookingIds: string[] = [];
  const skippedBookingIds: string[] = [];
  const failed: DeferredAssignmentDispatchFailure[] = [];
  let attemptedCount = 0;

  for (const candidate of candidates) {
    const dispatchPhase = resolveDeferredDispatchStatus({
      bookingStatus: "confirmed",
      assignmentDispatchAt: candidate.assignmentDispatchAt,
    }).phase;

    const eligible = await stillDeferredDispatchCandidate(client, candidate.bookingId, now);
    if (!eligible) {
      skippedBookingIds.push(candidate.bookingId);
      logDeferredDispatchBookingAttempt({
        bookingId: candidate.bookingId,
        assignmentDispatchAt: candidate.assignmentDispatchAt,
        dispatchPhase,
        outcome: "skipped",
        reason: "no_longer_eligible",
      });
      continue;
    }

    attemptedCount += 1;
    const result = await runAssignmentAfterPayment(client, backend, candidate.bookingId);

    if (result.ok) {
      const booking = await backend.getBooking(candidate.bookingId);
      if (booking?.status === "confirmed") {
        failed.push({
          bookingId: candidate.bookingId,
          code: "STILL_CONFIRMED",
          message: `Dispatch cron ran but booking remained confirmed (outcome=${result.outcome}).`,
        });
        logDeferredDispatchBookingAttempt({
          bookingId: candidate.bookingId,
          scheduledStart: booking.scheduled_start,
          assignmentDispatchAt: candidate.assignmentDispatchAt,
          dispatchPhase,
          outcome: "failed",
          code: "STILL_CONFIRMED",
          reason: result.outcome,
        });
      } else {
        dispatchedBookingIds.push(candidate.bookingId);
        logDeferredDispatchBookingAttempt({
          bookingId: candidate.bookingId,
          scheduledStart: booking?.scheduled_start,
          assignmentDispatchAt: candidate.assignmentDispatchAt,
          dispatchPhase,
          outcome: "dispatched",
        });
      }
    } else {
      failed.push({
        bookingId: candidate.bookingId,
        code: result.code,
        message: result.message,
      });
      logDeferredDispatchBookingAttempt({
        bookingId: candidate.bookingId,
        assignmentDispatchAt: candidate.assignmentDispatchAt,
        dispatchPhase,
        outcome: "failed",
        code: result.code,
        reason: result.message,
      });
    }
  }

  const batchResult: DeferredAssignmentDispatchBatchResult = {
    candidateCount: candidates.length,
    attemptedCount,
    dispatchedBookingIds,
    skippedBookingIds,
    failed,
  };

  if (options.logCronSummary !== false) {
    logDeferredDispatchCronRun({
      ranAt,
      result: batchResult,
      durationMs: Date.now() - startedAt,
    });
  }

  return batchResult;
}
