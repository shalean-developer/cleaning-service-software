import "server-only";

import { bookingHasPaidPayment } from "@/features/bookings/server/paymentRetryEligibility";
import type { BookingRow, PaymentRow } from "@/lib/database/types";

function isScheduleInPast(scheduledStart: string): boolean {
  return new Date(scheduledStart).getTime() < Date.now();
}

/**
 * Whether a customer may open Paystack checkout for an unpaid pending_payment booking
 * (reuses existing pending payment row when present).
 */
export function assessPendingPaymentCheckoutEligibility(
  booking: BookingRow,
  payments: PaymentRow[],
): boolean {
  if (booking.status !== "pending_payment") return false;
  if (bookingHasPaidPayment(payments)) return false;
  if (isScheduleInPast(booking.scheduled_start)) return false;
  return true;
}
