import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingRow } from "@/lib/database/types";
import type { Database } from "@/lib/database/types";
import { runAssignmentAfterPayment } from "@/features/assignments/server/runAssignmentAfterPayment";
import {
  assignmentResultNeedsDispatchAttention,
  handlePostPaymentAssignmentFailure,
} from "@/features/assignments/server/postPaymentAssignmentObservability";
import { getDeferredAssignmentConfig } from "@/features/assignments/server/assignmentDispatchConfig";
import {
  computeAssignmentDispatchAt,
  shouldRunAssignmentNow,
} from "@/features/assignments/server/computeAssignmentDispatchAt";
import {
  logAssignmentDeferred,
  recordDeferredAssignment,
} from "@/features/assignments/server/recordDeferredAssignment";
import type { RunAssignmentResult } from "@/features/assignments/server/types";
import type { PaystackChargeSuccess } from "./paystackTypes";

export type PostPaymentAssignmentDispatchInput = {
  bookingId: string;
  paymentId: string;
  customerId: string | null;
  charge: PaystackChargeSuccess;
};

export type PostPaymentAssignmentDispatchResult =
  | { action: "ran"; assignmentDispatchAt: string; assignmentResult: RunAssignmentResult }
  | { action: "deferred"; assignmentDispatchAt: string }
  | {
      action: "skipped_immediate";
      assignmentDispatchAt: string;
      assignmentResult: RunAssignmentResult;
    };

export async function persistAssignmentDispatchAt(
  backend: BookingCommandBackend,
  bookingId: string,
  scheduledStart: string,
  config = getDeferredAssignmentConfig(),
): Promise<string> {
  const dispatchAt = computeAssignmentDispatchAt(scheduledStart, config.dispatchLeadDays);
  await backend.updateAssignmentDispatchAt(bookingId, dispatchAt);
  return dispatchAt;
}

/**
 * After payment finalization: persist dispatch window, then run or defer assignment.
 * Never rolls back payment; deferred path does not record dispatch failures.
 */
export async function runPostPaymentAssignmentDispatch(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  booking: BookingRow,
  input: PostPaymentAssignmentDispatchInput,
  options: { config?: ReturnType<typeof getDeferredAssignmentConfig>; now?: Date } = {},
): Promise<PostPaymentAssignmentDispatchResult> {
  const config = options.config ?? getDeferredAssignmentConfig();
  const now = options.now ?? new Date();

  const assignmentDispatchAt = await persistAssignmentDispatchAt(
    backend,
    booking.id,
    booking.scheduled_start,
    config,
  );

  const runNow = !config.enabled || shouldRunAssignmentNow(assignmentDispatchAt, now);

  if (!runNow) {
    logAssignmentDeferred({
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      assignmentDispatchAt,
    });
    await recordDeferredAssignment(backend, input.bookingId, assignmentDispatchAt);
    return { action: "deferred", assignmentDispatchAt };
  }

  const action = config.enabled ? "ran" : "skipped_immediate";
  return runAssignmentWithObservability(client, backend, input, assignmentDispatchAt, action);
}

async function runAssignmentWithObservability(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  input: PostPaymentAssignmentDispatchInput,
  assignmentDispatchAt: string,
  action: "ran" | "skipped_immediate",
): Promise<PostPaymentAssignmentDispatchResult> {
  try {
    const assignmentResult = await runAssignmentAfterPayment(
      client,
      backend,
      input.bookingId,
    );
    const bookingAfterAssignment = await backend.getBooking(input.bookingId);
    const bookingStatusAfter = bookingAfterAssignment?.status ?? "unknown";

    if (assignmentResultNeedsDispatchAttention(assignmentResult, bookingStatusAfter)) {
      await handlePostPaymentAssignmentFailure(backend, {
        bookingId: input.bookingId,
        paymentId: input.paymentId,
        customerId: input.customerId,
        paystackReference: input.charge.reference,
        paystackTransactionId: input.charge.transactionId,
        assignmentCode: assignmentResult.ok ? "STILL_CONFIRMED" : assignmentResult.code,
        assignmentMessage: assignmentResult.ok
          ? `Assignment finished but booking remained confirmed (outcome=${assignmentResult.outcome}).`
          : assignmentResult.message,
        bookingStatusAfter,
        thrown: false,
      });
    }

    return { action, assignmentDispatchAt, assignmentResult };
  } catch (error) {
    const bookingAfterError = await backend.getBooking(input.bookingId);
    await handlePostPaymentAssignmentFailure(backend, {
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      customerId: input.customerId,
      paystackReference: input.charge.reference,
      paystackTransactionId: input.charge.transactionId,
      assignmentCode: "ASSIGNMENT_EXCEPTION",
      assignmentMessage: error instanceof Error ? error.message : String(error),
      bookingStatusAfter: bookingAfterError?.status ?? "unknown",
      thrown: true,
    });
    throw error;
  }
}
