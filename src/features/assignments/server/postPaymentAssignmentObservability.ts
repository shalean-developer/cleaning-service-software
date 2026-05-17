import "server-only";

import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { RunAssignmentResult } from "./types";
import { recordAssignmentOutcome } from "./recordAssignmentOutcome";
import { DISPATCH_NOT_STARTED_REASON } from "./isAssignmentRecoveryCandidate";

export type PostPaymentAssignmentFailureContext = {
  bookingId: string;
  paymentId: string;
  customerId: string | null;
  paystackReference?: string | null;
  paystackTransactionId?: string | number | null;
  assignmentCode?: string;
  assignmentMessage?: string;
  bookingStatusAfter: string;
  thrown?: boolean;
};

export function logPostPaymentAssignmentFailure(
  ctx: PostPaymentAssignmentFailureContext,
): void {
  console.warn(
    JSON.stringify({
      event: "post_payment_assignment_failed",
      at: new Date().toISOString(),
      ...ctx,
    }),
  );
}

export async function recordPostPaymentAssignmentDispatchFailure(
  backend: BookingCommandBackend,
  bookingId: string,
): Promise<void> {
  await recordAssignmentOutcome(backend, bookingId, {
    status: "attention_required",
    path: null,
    cleanerId: null,
    offerId: null,
    reason: DISPATCH_NOT_STARTED_REASON,
  });
}

export async function handlePostPaymentAssignmentFailure(
  backend: BookingCommandBackend,
  ctx: PostPaymentAssignmentFailureContext,
): Promise<void> {
  logPostPaymentAssignmentFailure(ctx);
  try {
    await recordPostPaymentAssignmentDispatchFailure(backend, ctx.bookingId);
  } catch (metaError) {
    console.warn(
      JSON.stringify({
        event: "post_payment_assignment_metadata_failed",
        at: new Date().toISOString(),
        bookingId: ctx.bookingId,
        message: metaError instanceof Error ? metaError.message : String(metaError),
      }),
    );
  }
}

export function assignmentResultNeedsDispatchAttention(
  result: RunAssignmentResult,
  bookingStatusAfter: string,
): boolean {
  if (bookingStatusAfter === "confirmed") return true;
  if (!result.ok) return true;
  return false;
}
