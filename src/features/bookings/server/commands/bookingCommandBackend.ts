import type {
  AssignmentOfferRow,
  BookingCleanerRole,
  BookingCleanerRow,
  BookingCleanerStatus,
  BookingRow,
  BookingStateAuditRow,
  EarningLineRow,
  EarningPayoutStatus,
  Json,
  PaymentRow,
} from "@/lib/database/types";
import type { CleanerLifecycleSnapshot } from "@/features/cleaners/server/lifecycle/operationalState";
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
  getCleanerLifecycleSnapshot(
    cleanerId: string,
  ): Promise<CleanerLifecycleSnapshot | null>;

  insertBooking(row: BookingRow): Promise<void>;
  updateBookingMetadata(bookingId: string, metadata: Json): Promise<void>;
  updateBookingSchedule(
    bookingId: string,
    scheduledStart: string,
    scheduledEnd: string,
  ): Promise<void>;
  /** Clears primary cleaner and returns booking to pending_assignment (assigned only). */
  releaseAssignedCleanerForReschedule(
    bookingId: string,
    fromStatus: BookingStatus,
  ): Promise<void>;
  updateAssignmentDispatchAt(
    bookingId: string,
    assignmentDispatchAt: string | null,
  ): Promise<void>;
  insertPayment(payment: PaymentRow): Promise<void>;
  insertOffer(offer: AssignmentOfferRow): Promise<void>;
  updateOffer(offer: AssignmentOfferRow): Promise<void>;

  /** NF-7D: roster row for offer slot (no-op when team offers disabled in command layer). */
  upsertBookingCleanerRoster(params: {
    bookingId: string;
    cleanerId: string;
    role: BookingCleanerRole;
    status: BookingCleanerStatus;
    assignedByProfileId?: string | null;
  }): Promise<BookingCleanerRow>;

  updateBookingCleanerRosterStatus(
    rosterId: string,
    status: BookingCleanerStatus,
  ): Promise<void>;

  listBookingCleanersForBooking(bookingId: string): Promise<BookingCleanerRow[]>;

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
  /** NF-7H: Adjust pending completion line payout (true-up). Returns false if line not pending. */
  updateEarningLinePayoutAmount(
    bookingId: string,
    lineId: string,
    payoutAmountCents: number,
    teamMetadata?: {
      team_earning_role?: EarningLineRow["team_earning_role"];
      team_earning_source?: EarningLineRow["team_earning_source"];
    },
  ): Promise<boolean>;
  updateEarningLinesPayoutStatus(
    bookingId: string,
    from: EarningPayoutStatus,
    to: EarningPayoutStatus,
    payoutBatchId?: string | null,
  ): Promise<number>;
}
