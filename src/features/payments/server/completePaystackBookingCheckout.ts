import "server-only";

import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { getServerPaystackPaymentSuccessCallbackUrl } from "@/lib/app/appBaseUrl";
import type { PaymentRow } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { paystackInitializeTransaction } from "./paystackClient";
import { getPaymentById, updatePaymentProviderRef } from "./paymentRepository";

export type CompletePaystackBookingCheckoutInput = {
  bookingId: string;
  payment: PaymentRow;
  email: string;
  callbackUrl?: string;
  lockId?: string | null;
  metadataSource?: "booking" | "admin_assisted";
};

export type CompletePaystackBookingCheckoutSuccess = {
  ok: true;
  bookingId: string;
  paymentId: string;
  status: "pending_payment";
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type CompletePaystackBookingCheckoutFailure = {
  ok: false;
  code: string;
  message: string;
  status: number;
};

export type CompletePaystackBookingCheckoutResult =
  | CompletePaystackBookingCheckoutSuccess
  | CompletePaystackBookingCheckoutFailure;

export function buildPaystackReference(bookingId: string, paymentId: string): string {
  const suffix = paymentId.replace(/-/g, "").slice(0, 12);
  return `bk_${bookingId.replace(/-/g, "").slice(0, 8)}_${suffix}`;
}

export async function completePaystackBookingCheckout(
  input: CompletePaystackBookingCheckoutInput,
): Promise<CompletePaystackBookingCheckoutResult> {
  const backend = createBookingCommandBackend();
  const booking = await backend.getBooking(input.bookingId);
  if (!booking) {
    return {
      ok: false,
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found.",
      status: 404,
    };
  }

  const serviceClient = requireServiceRoleClient();
  const { bookingId, payment, email, callbackUrl, lockId } = input;

  const paystackAmount = booking.price_cents;
  if (payment.amount_cents !== paystackAmount) {
    return {
      ok: false,
      code: "QUOTE_MISMATCH",
      message: "Payment amount does not match booking price.",
      status: 409,
    };
  }

  const reference =
    payment.provider_ref?.trim() || buildPaystackReference(bookingId, payment.id);

  const resolvedCallbackUrl =
    callbackUrl?.trim() || getServerPaystackPaymentSuccessCallbackUrl();
  if (!resolvedCallbackUrl) {
    return {
      ok: false,
      code: "CALLBACK_URL_MISSING",
      message:
        "Paystack callback URL is not configured. Set APP_BASE_URL or NEXT_PUBLIC_APP_URL (e.g. http://localhost:3000).",
      status: 503,
    };
  }

  const paystack = await paystackInitializeTransaction({
    email,
    amount: paystackAmount,
    reference,
    currency: booking.currency,
    callback_url: resolvedCallbackUrl,
    metadata: {
      source: input.metadataSource ?? "booking",
      booking_id: bookingId,
      payment_id: payment.id,
      customer_id: booking.customer_id,
      lock_id: lockId ?? null,
    },
  });

  if (payment.provider_ref !== paystack.data.reference) {
    await updatePaymentProviderRef(serviceClient, payment.id, paystack.data.reference);
  }

  const refreshed = await getPaymentById(serviceClient, payment.id);

  return {
    ok: true,
    bookingId,
    paymentId: refreshed?.id ?? payment.id,
    status: "pending_payment",
    authorizationUrl: paystack.data.authorization_url,
    accessCode: paystack.data.access_code,
    reference: paystack.data.reference,
  };
}

export async function findPendingPaymentForBooking(
  bookingId: string,
): Promise<PaymentRow | null> {
  const backend = createBookingCommandBackend();
  const payments = await backend.listPaymentsForBooking(bookingId);
  return payments.find((p) => p.status === "pending") ?? null;
}
