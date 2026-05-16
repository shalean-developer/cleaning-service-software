import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { finalizePaidBookingWithDeps } from "./finalizePaidBooking";
import type { PaystackChargeSuccess } from "./paystackTypes";
import { findPaymentByProviderRef } from "./paymentRepository";

export type ProcessPaystackChargeResult =
  | {
      ok: true;
      bookingId: string;
      status: string;
      idempotent: boolean;
      paymentEvent: "inserted" | "duplicate";
      recoveredFromAlreadyFinalized?: boolean;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

/**
 * Resolves payment/booking from Paystack reference and runs shared finalization.
 */
export async function processPaystackChargeSuccess(
  charge: PaystackChargeSuccess,
  source: "webhook" | "verify",
): Promise<ProcessPaystackChargeResult> {
  const client = requireServiceRoleClient();
  return processPaystackChargeSuccessWithDeps(client, charge, source);
}

export async function processPaystackChargeSuccessWithDeps(
  client: SupabaseClient<Database>,
  charge: PaystackChargeSuccess,
  source: "webhook" | "verify",
  backend: BookingCommandBackend = createBookingCommandBackend(),
): Promise<ProcessPaystackChargeResult> {
  const payment = await findPaymentByProviderRef(client, charge.reference);
  if (!payment) {
    return {
      ok: false,
      code: "PAYMENT_NOT_FOUND",
      message: `No payment row for Paystack reference ${charge.reference}.`,
    };
  }

  const result = await finalizePaidBookingWithDeps(client, backend, {
    bookingId: payment.booking_id,
    paymentId: payment.id,
    charge,
    source,
  });

  if (!result.ok) {
    return {
      ok: false,
      code: "code" in result ? result.code : "FINALIZE_FAILED",
      message: "message" in result ? result.message : "Finalization failed.",
    };
  }

  return {
    ok: true,
    bookingId: result.bookingId,
    status: result.status,
    idempotent: result.idempotent,
    paymentEvent: result.paymentEvent,
    ...(result.recoveredFromAlreadyFinalized
      ? { recoveredFromAlreadyFinalized: true as const }
      : {}),
  };
}
