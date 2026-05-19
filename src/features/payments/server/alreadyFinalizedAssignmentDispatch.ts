import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isOfferOpenForOps } from "@/features/assignments/server/buildOfferExpiry";
import { listOffersForBooking } from "@/features/assignments/server/offerRepository";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { Database } from "@/lib/database/types";
import { getPaymentById } from "./paymentRepository";
import { isPaidPaymentStatus } from "./paymentFinalizeRecovery";
import {
  runPostPaymentAssignmentDispatch,
  type PostPaymentAssignmentDispatchInput,
} from "./postPaymentAssignmentDispatch";

/** Statuses where post-payment assignment dispatch may still be needed after recovery. */
export const RECOVERY_ASSIGNMENT_DISPATCH_STATUSES = [
  "confirmed",
  "pending_assignment",
] as const satisfies readonly BookingStatus[];

export function isRecoveryAssignmentDispatchEligibleStatus(
  status: BookingStatus,
): boolean {
  return (RECOVERY_ASSIGNMENT_DISPATCH_STATUSES as readonly BookingStatus[]).includes(
    status,
  );
}

export type AlreadyFinalizedAssignmentDispatchInput = PostPaymentAssignmentDispatchInput;

/**
 * True when payment is paid, booking is confirmed/pending_assignment without a cleaner,
 * and there is no open or accepted assignment offer.
 */
export async function shouldDispatchAssignmentAfterAlreadyFinalizedRecovery(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  bookingId: string,
  paymentId: string,
  options: { now?: Date } = {},
): Promise<boolean> {
  const now = options.now ?? new Date();
  const payment =
    (await backend.getPayment(paymentId)) ?? (await getPaymentById(client, paymentId));
  const booking = await backend.getBooking(bookingId);

  if (!payment || !booking) return false;
  if (payment.booking_id !== booking.id) return false;
  if (!isPaidPaymentStatus(payment.status)) return false;
  if (!isRecoveryAssignmentDispatchEligibleStatus(booking.status)) return false;
  if (booking.cleaner_id) return false;

  const offers = await listOffersForBooking(client, bookingId);
  if (offers.some((o) => o.status === "accepted")) return false;
  if (offers.some((o) => isOfferOpenForOps(o, now))) return false;

  return true;
}

/**
 * After already-finalized payment recovery, run assignment dispatch only when the booking
 * still has no assignment progress. Idempotent: delegates to runAssignmentAfterPayment.
 */
export async function tryDispatchAssignmentAfterAlreadyFinalizedRecovery(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  input: AlreadyFinalizedAssignmentDispatchInput,
): Promise<{ dispatched: boolean }> {
  const shouldDispatch = await shouldDispatchAssignmentAfterAlreadyFinalizedRecovery(
    client,
    backend,
    input.bookingId,
    input.paymentId,
  );
  if (!shouldDispatch) return { dispatched: false };

  const booking = await backend.getBooking(input.bookingId);
  if (!booking) return { dispatched: false };

  try {
    await runPostPaymentAssignmentDispatch(client, backend, booking, input);
    return { dispatched: true };
  } catch {
    // Failure observability is recorded inside runPostPaymentAssignmentDispatch.
    return { dispatched: false };
  }
}
