import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import type { BookingCommandResult } from "@/features/bookings/server/commands/types";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getPaymentById } from "./paymentRepository";
import { paystackFinalizeIdempotencyKey } from "./mapPaystackCharge";
import type { PaystackChargeSuccess } from "./paystackTypes";
import { recordPaymentEvent } from "./recordPaymentEvent";
import {
  isRecoverableFinalizeCommandFailure,
  tryRecoverAlreadyFinalizedPayment,
} from "./paymentFinalizeRecovery";
import { runAssignmentAfterPayment } from "@/features/assignments/server/runAssignmentAfterPayment";
import {
  assignmentResultNeedsDispatchAttention,
  handlePostPaymentAssignmentFailure,
} from "@/features/assignments/server/postPaymentAssignmentObservability";

export type FinalizePaidBookingInput = {
  bookingId: string;
  paymentId: string;
  charge: PaystackChargeSuccess;
  source: "webhook" | "verify";
};

export type FinalizePaidBookingResult =
  | (BookingCommandResult & {
      paymentEvent: "inserted" | "duplicate";
      recoveredFromAlreadyFinalized?: boolean;
    })
  | {
      ok: false;
      code:
        | "AMOUNT_MISMATCH"
        | "PAYMENT_NOT_FOUND"
        | "BOOKING_MISMATCH"
        | "PERSISTENCE_ERROR";
      message: string;
    };

export async function finalizePaidBooking(
  input: FinalizePaidBookingInput,
): Promise<FinalizePaidBookingResult> {
  const client = requireServiceRoleClient();
  const backend = createBookingCommandBackend("supabase");
  return finalizePaidBookingWithDeps(client, backend, input);
}

export type FinalizePaidBookingDeps = {
  recordEvent?: typeof recordPaymentEvent;
};

export async function finalizePaidBookingWithDeps(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  input: FinalizePaidBookingInput,
  deps: FinalizePaidBookingDeps = {},
): Promise<FinalizePaidBookingResult> {
  const recordEvent = deps.recordEvent ?? recordPaymentEvent;
  const payment = await getPaymentById(client, input.paymentId);
  if (!payment) {
    return {
      ok: false,
      code: "PAYMENT_NOT_FOUND",
      message: "Payment row not found.",
    };
  }

  if (payment.booking_id !== input.bookingId) {
    return {
      ok: false,
      code: "BOOKING_MISMATCH",
      message: "Payment does not belong to the supplied booking.",
    };
  }

  if (payment.amount_cents !== input.charge.amountCents) {
    return {
      ok: false,
      code: "AMOUNT_MISMATCH",
      message: `Paystack amount ${input.charge.amountCents} does not match payment.amount_cents ${payment.amount_cents}.`,
    };
  }

  const idempotencyKey = paystackFinalizeIdempotencyKey(input.charge);

  let paymentEvent: "inserted" | "duplicate" = "inserted";
  try {
    const recorded = await recordEvent(client, {
      paymentId: payment.id,
      providerEventId: input.charge.providerEventId,
      eventType: input.source === "webhook" ? "charge.success" : "verify.success",
      payload: {
        reference: input.charge.reference,
        transactionId: input.charge.transactionId,
        amountCents: input.charge.amountCents,
        metadata: input.charge.metadata,
        source: input.source,
      },
    });
    paymentEvent = recorded.outcome;
  } catch {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Could not record payment_events row.",
    };
  }

  const commandResult = await executeBookingCommand(backend, {
    type: "FINALIZE_PAYMENT_SUCCESS",
    actor: { actorType: "service", profileId: null },
    bookingId: input.bookingId,
    paymentId: payment.id,
    idempotencyKey,
    reason: `Paystack ${input.source}`,
    metadata: {
      paystackReference: input.charge.reference,
      paystackTransactionId: input.charge.transactionId,
    },
  });

  if (!commandResult.ok) {
    if (isRecoverableFinalizeCommandFailure(commandResult)) {
      const recovered = await tryRecoverAlreadyFinalizedPayment(
        client,
        backend,
        input.bookingId,
        payment.id,
      );
      if (recovered) {
        return {
          ok: true,
          bookingId: recovered.bookingId,
          status: recovered.status,
          idempotent: true,
          recoveredFromAlreadyFinalized: true,
          paymentEvent,
        };
      }
    }
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: commandResult.message,
    };
  }

  const bookingAfterFinalize = await backend.getBooking(input.bookingId);
  const customerId = bookingAfterFinalize?.customer_id ?? null;

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
        paymentId: payment.id,
        customerId,
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
  } catch (error) {
    const bookingAfterError = await backend.getBooking(input.bookingId);
    await handlePostPaymentAssignmentFailure(backend, {
      bookingId: input.bookingId,
      paymentId: payment.id,
      customerId,
      paystackReference: input.charge.reference,
      paystackTransactionId: input.charge.transactionId,
      assignmentCode: "ASSIGNMENT_EXCEPTION",
      assignmentMessage: error instanceof Error ? error.message : String(error),
      bookingStatusAfter: bookingAfterError?.status ?? "unknown",
      thrown: true,
    });
  }

  return { ...commandResult, paymentEvent };
}
