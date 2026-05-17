import type {
  AssignmentOfferRow,
  BookingRow,
  BookingStateAuditRow,
  EarningLineRow,
  EarningPayoutStatus,
  Json,
  PaymentRow,
} from "@/lib/database/types";
import type { BookingStatus } from "../types";
import type { BookingCommand } from "./types";

export type TransitionResult = {
  status: BookingStatus;
  idempotent: boolean;
};

/**
 * Persistence port for {@link executeBookingCommand}.
 * In-memory and Supabase implementations must honor the same contracts as the RPC layer.
 */
export interface BookingCommandBackend {
  getBooking(bookingId: string): Promise<BookingRow | null>;
  getPayment(paymentId: string): Promise<PaymentRow | null>;
  getOffer(offerId: string): Promise<AssignmentOfferRow | null>;
  findPaymentByIdempotencyKey(key: string): Promise<PaymentRow | null>;
  listPaymentsForBooking(bookingId: string): Promise<PaymentRow[]>;
  listOffersForBooking(bookingId: string): Promise<AssignmentOfferRow[]>;
  findAuditsByBookingAndKey(
    bookingId: string,
    key: string | null | undefined,
  ): Promise<BookingStateAuditRow[]>;
  hasPaidPaymentForBooking(bookingId: string): Promise<boolean>;

  insertBooking(row: BookingRow): Promise<void>;
  updateBookingMetadata(bookingId: string, metadata: Json): Promise<void>;
  insertPayment(payment: PaymentRow): Promise<void>;
  insertOffer(offer: AssignmentOfferRow): Promise<void>;
  updateOffer(offer: AssignmentOfferRow): Promise<void>;

  appendAudit(
    cmd: BookingCommand,
    bookingId: string,
    from: BookingStatus | null,
    to: BookingStatus,
  ): Promise<void>;

  applyTransition(
    cmd: BookingCommand,
    bookingId: string,
    from: BookingStatus,
    to: BookingStatus,
    cleanerId?: string | null,
  ): Promise<TransitionResult>;

  finalizePaymentSuccess(
    cmd: BookingCommand & { type: "FINALIZE_PAYMENT_SUCCESS" },
    bookingId: string,
    paymentId: string,
  ): Promise<TransitionResult>;

  recordPaymentFailure(
    cmd: BookingCommand & { type: "MARK_PAYMENT_FAILED" },
    bookingId: string,
    paymentId: string,
  ): Promise<TransitionResult>;

  expireAssignmentOffer(
    cmd: BookingCommand & { type: "EXPIRE_ASSIGNMENT_OFFER" },
    bookingId: string,
    offerId: string,
  ): Promise<TransitionResult>;

  adminOverrideStatus(
    cmd: BookingCommand & { type: "ADMIN_OVERRIDE_STATUS" },
    booking: BookingRow,
  ): Promise<BookingStatus>;

  enqueueNotification(channel: string, recipient: string, payload: Json): Promise<void>;
  appendEarningLine(line: Omit<EarningLineRow, "id" | "created_at">): Promise<void>;
  listEarningLinesForBooking(bookingId: string): Promise<EarningLineRow[]>;
  updateEarningLinesPayoutStatus(
    bookingId: string,
    from: EarningPayoutStatus,
    to: EarningPayoutStatus,
    payoutBatchId?: string | null,
  ): Promise<number>;
}
