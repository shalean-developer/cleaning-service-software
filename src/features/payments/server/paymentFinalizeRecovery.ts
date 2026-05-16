import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingCommandResult } from "@/features/bookings/server/commands/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { Database, PaymentStatus } from "@/lib/database/types";
import { getPaymentById } from "./paymentRepository";

/** Booking statuses that imply payment was accepted and lifecycle moved forward. */
export const POST_PAYMENT_BOOKING_STATUSES = [
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
] as const satisfies readonly BookingStatus[];

export type PostPaymentBookingStatus = (typeof POST_PAYMENT_BOOKING_STATUSES)[number];

export function isPostPaymentBookingStatus(status: BookingStatus): boolean {
  return (POST_PAYMENT_BOOKING_STATUSES as readonly BookingStatus[]).includes(status);
}

export function isPaidPaymentStatus(status: PaymentStatus): boolean {
  return status === "paid";
}

export type AlreadyFinalizedRecoveryResult = {
  ok: true;
  bookingId: string;
  status: BookingStatus;
  idempotent: true;
  recoveredFromAlreadyFinalized: true;
};

/**
 * Command failures that may indicate a concurrent path already finalized payment.
 */
export function isRecoverableFinalizeCommandFailure(result: BookingCommandResult): boolean {
  if (result.ok) return false;
  return result.code === "PERSISTENCE_ERROR" || result.code === "INVALID_TRANSITION";
}

/**
 * Re-reads payment + booking after a finalize command failure. Returns success only when
 * payment is paid and booking is already in a post-payment lifecycle state.
 */
export async function tryRecoverAlreadyFinalizedPayment(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  bookingId: string,
  paymentId: string,
): Promise<AlreadyFinalizedRecoveryResult | null> {
  const payment =
    (await backend.getPayment(paymentId)) ?? (await getPaymentById(client, paymentId));
  const booking = await backend.getBooking(bookingId);

  if (!payment || !booking) return null;
  if (payment.booking_id !== booking.id) return null;
  if (!isPaidPaymentStatus(payment.status)) return null;
  if (!isPostPaymentBookingStatus(booking.status)) return null;

  return {
    ok: true,
    bookingId: booking.id,
    status: booking.status,
    idempotent: true,
    recoveredFromAlreadyFinalized: true,
  };
}
