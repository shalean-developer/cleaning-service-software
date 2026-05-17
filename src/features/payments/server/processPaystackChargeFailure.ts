import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PAYSTACK_DECLINED_FAILURE_REASON } from "@/features/bookings/server/paymentFailureDisplay";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import type { Database, PaymentRow } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  isPaidPaymentStatus,
  isPostPaymentBookingStatus,
} from "./paymentFinalizeRecovery";
import { paystackFailureCommandIdempotencyKey } from "./mapPaystackCharge";
import { findPaymentByProviderRef } from "./paymentRepository";
import type { PaystackChargeFailure } from "./paystackTypes";
import { recordPaymentEvent } from "./recordPaymentEvent";

const serviceActor = { actorType: "service" as const, profileId: null };

export type ProcessPaystackChargeFailureResult =
  | {
      ok: true;
      handled: true;
      bookingId: string;
      status: string;
      idempotent: boolean;
      paymentEvent: "inserted" | "duplicate";
    }
  | {
      ok: true;
      handled: false;
      reason: string;
      idempotent?: boolean;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

function readMetadataId(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataMatchesPayment(
  charge: PaystackChargeFailure,
  payment: PaymentRow,
): boolean {
  const metaBookingId = readMetadataId(charge.metadata, "booking_id");
  const metaPaymentId = readMetadataId(charge.metadata, "payment_id");
  if (metaBookingId && metaBookingId !== payment.booking_id) return false;
  if (metaPaymentId && metaPaymentId !== payment.id) return false;
  return true;
}

async function recordFailurePaymentEvent(
  client: SupabaseClient<Database>,
  paymentId: string,
  charge: PaystackChargeFailure,
  extra: Record<string, unknown> = {},
): Promise<"inserted" | "duplicate"> {
  const recorded = await recordPaymentEvent(client, {
    paymentId,
    providerEventId: charge.providerEventId,
    eventType: "charge.failed",
    payload: {
      reference: charge.reference,
      transactionId: charge.transactionId,
      amountCents: charge.amountCents,
      paystackStatus: charge.paystackStatus,
      gatewayResponse: charge.gatewayResponse ?? null,
      metadata: charge.metadata,
      source: "webhook",
      ...extra,
    },
  });
  return recorded.outcome;
}

async function runMarkPaymentFailed(
  backend: BookingCommandBackend,
  payment: PaymentRow,
  charge: PaystackChargeFailure,
): Promise<
  | { ok: true; bookingId: string; status: string; idempotent: boolean }
  | { ok: false; code: string; message: string }
> {
  const commandResult = await executeBookingCommand(backend, {
    type: "MARK_PAYMENT_FAILED",
    actor: serviceActor,
    bookingId: payment.booking_id,
    paymentId: payment.id,
    idempotencyKey: paystackFailureCommandIdempotencyKey(charge),
    reason: "Paystack payment failed or declined",
    metadata: {
      failure_reason: PAYSTACK_DECLINED_FAILURE_REASON,
      source: "paystack_webhook",
      paystack_reference: charge.reference,
      paystack_transaction_id: charge.transactionId,
      paystack_status: charge.paystackStatus,
      gateway_response: charge.gatewayResponse ?? null,
    },
  });

  if (!commandResult.ok) {
    if (
      commandResult.code === "INVALID_TRANSITION" ||
      commandResult.code === "TERMINAL_STATE"
    ) {
      const refreshed = await backend.getBooking(payment.booking_id);
      return {
        ok: true,
        bookingId: payment.booking_id,
        status: refreshed?.status ?? "payment_failed",
        idempotent: true,
      };
    }
    return {
      ok: false,
      code: commandResult.code,
      message: commandResult.message,
    };
  }

  return {
    ok: true,
    bookingId: commandResult.bookingId,
    status: commandResult.status,
    idempotent: commandResult.idempotent,
  };
}

/**
 * Resolves payment/booking from Paystack reference and marks failure via MARK_PAYMENT_FAILED.
 */
export async function processPaystackChargeFailure(
  charge: PaystackChargeFailure,
): Promise<ProcessPaystackChargeFailureResult> {
  const client = requireServiceRoleClient();
  return processPaystackChargeFailureWithDeps(client, charge);
}

export async function processPaystackChargeFailureWithDeps(
  client: SupabaseClient<Database>,
  charge: PaystackChargeFailure,
  backend: BookingCommandBackend = createBookingCommandBackend(),
): Promise<ProcessPaystackChargeFailureResult> {
  const payment = await findPaymentByProviderRef(client, charge.reference);
  if (!payment) {
    return {
      ok: true,
      handled: false,
      reason: "payment_not_found",
    };
  }

  if (!metadataMatchesPayment(charge, payment)) {
    return {
      ok: true,
      handled: false,
      reason: "metadata_mismatch",
    };
  }

  const booking = await backend.getBooking(payment.booking_id);
  if (!booking) {
    return {
      ok: true,
      handled: false,
      reason: "booking_not_found",
    };
  }

  if (isPaidPaymentStatus(payment.status) || isPostPaymentBookingStatus(booking.status)) {
    let paymentEvent: "inserted" | "duplicate" = "inserted";
    try {
      paymentEvent = await recordFailurePaymentEvent(client, payment.id, charge, {
        skipped: "already_paid",
      });
    } catch {
      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: "Could not record payment_events row.",
      };
    }
    return {
      ok: true,
      handled: false,
      reason: "skipped:already_paid",
      idempotent: paymentEvent === "duplicate",
    };
  }

  if (booking.status === "payment_failed") {
    let paymentEvent: "inserted" | "duplicate" = "inserted";
    try {
      paymentEvent = await recordFailurePaymentEvent(client, payment.id, charge, {
        skipped: "already_payment_failed",
      });
    } catch {
      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: "Could not record payment_events row.",
      };
    }
    return {
      ok: true,
      handled: true,
      bookingId: booking.id,
      status: booking.status,
      idempotent: true,
      paymentEvent,
    };
  }

  if (booking.status !== "pending_payment") {
    return {
      ok: true,
      handled: false,
      reason: "skipped:not_awaiting_payment",
    };
  }

  let paymentEvent: "inserted" | "duplicate" = "inserted";
  try {
    paymentEvent = await recordFailurePaymentEvent(client, payment.id, charge);
  } catch {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Could not record payment_events row.",
    };
  }

  const marked = await runMarkPaymentFailed(backend, payment, charge);
  if (!marked.ok) {
    return {
      ok: false,
      code: marked.code,
      message: marked.message,
    };
  }

  return {
    ok: true,
    handled: true,
    bookingId: marked.bookingId,
    status: marked.status,
    idempotent: marked.idempotent,
    paymentEvent,
  };
}
