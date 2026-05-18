import "server-only";

import type { DeferredAssignmentDispatchBatchResult } from "./runDeferredAssignmentDispatch";

export type DeferredDispatchLogOutcome = "dispatched" | "skipped" | "failed";

export function logDeferredDispatchCronRun(payload: {
  ranAt: string;
  result: DeferredAssignmentDispatchBatchResult;
  durationMs: number;
}): void {
  console.warn(
    JSON.stringify({
      event: "deferred_assignment_dispatch_cron",
      at: payload.ranAt,
      durationMs: payload.durationMs,
      candidateCount: payload.result.candidateCount,
      attemptedCount: payload.result.attemptedCount,
      dispatchedCount: payload.result.dispatchedBookingIds.length,
      skippedCount: payload.result.skippedBookingIds.length,
      failedCount: payload.result.failed.length,
      dispatchedBookingIds: payload.result.dispatchedBookingIds,
      skippedBookingIds: payload.result.skippedBookingIds,
      failed: payload.result.failed,
    }),
  );
}

export function logDeferredDispatchBookingAttempt(payload: {
  bookingId: string;
  scheduledStart?: string | null;
  assignmentDispatchAt: string;
  dispatchPhase: string;
  outcome: DeferredDispatchLogOutcome;
  reason?: string;
  code?: string;
}): void {
  console.warn(
    JSON.stringify({
      event: "deferred_assignment_dispatch_booking",
      bookingId: payload.bookingId,
      scheduled_start: payload.scheduledStart ?? null,
      assignment_dispatch_at: payload.assignmentDispatchAt,
      dispatch_phase: payload.dispatchPhase,
      outcome: payload.outcome,
      reason: payload.reason ?? null,
      code: payload.code ?? null,
    }),
  );
}
