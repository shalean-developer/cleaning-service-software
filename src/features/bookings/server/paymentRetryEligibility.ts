import "server-only";

import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { canRetryPaymentOnExistingBooking } from "@/features/bookings/server/paymentFailureDisplay";
import { parseRetryLockFromBooking } from "@/features/bookings/server/lock/parseRetryLockFromBooking";
import type { BookingRow, PaymentRow } from "@/lib/database/types";

export function bookingHasPaidPayment(payments: PaymentRow[]): boolean {
  return payments.some((p) => p.status === "paid");
}

function isScheduleInPast(scheduledStart: string): boolean {
  return new Date(scheduledStart).getTime() < Date.now();
}

/**
 * Whether production same-booking retry (retry-lock + initialize) may be offered in UI.
 * Caller must already enforce customer ownership and payment_failed status.
 */
export function assessPaymentRetryEligibility(
  booking: BookingRow,
  payments: PaymentRow[],
): boolean {
  if (booking.status !== "payment_failed") return false;
  if (!canRetryPaymentOnExistingBooking()) return false;
  if (bookingHasPaidPayment(payments)) return false;
  if (isScheduleInPast(booking.scheduled_start)) return false;

  const parsed = parseRetryLockFromBooking(booking);
  if (!parsed.ok) return false;

  const quoteResult = calculateQuote(parsed.pricingInput);
  if (!quoteResult.ok) return false;
  if (quoteResult.breakdown.totalCents !== booking.price_cents) return false;

  return true;
}
