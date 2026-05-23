import type { BookingCleanerRole } from "@/lib/database/types";
import type { BookingId, BookingStatus } from "../types";

/** Who initiated a command (never read from editable user_metadata for auth). */
export const BOOKING_ACTOR_TYPES = [
  "customer",
  "cleaner",
  "admin",
  "system",
  "service",
] as const;

export type BookingActorType = (typeof BOOKING_ACTOR_TYPES)[number];

export const BOOKING_COMMAND_TYPES = [
  "CREATE_BOOKING_DRAFT",
  "MARK_PAYMENT_PENDING",
  "FINALIZE_PAYMENT_SUCCESS",
  "CONFIRM_SERVICE_AUTHORIZED",
  "MARK_PAYMENT_FAILED",
  "MOVE_TO_PENDING_ASSIGNMENT",
  "OFFER_TO_CLEANER",
  "ACCEPT_CLEANER_ASSIGNMENT",
  "DECLINE_CLEANER_ASSIGNMENT",
  "CANCEL_OPEN_ASSIGNMENT_OFFER",
  "MARK_IN_PROGRESS",
  "MARK_COMPLETED",
  "MARK_BOOKING_IN_PROGRESS",
  "MARK_BOOKING_COMPLETED",
  "MARK_BOOKING_PAYOUT_READY",
  "MARK_BOOKING_PAID_OUT",
  "CANCEL_BOOKING",
  "ADMIN_OVERRIDE_STATUS",
  "RECORD_ASSIGNMENT_ATTENTION",
  "RECORD_ASSIGNMENT_OFFER_EXPIRED",
  "EXPIRE_ASSIGNMENT_OFFER",
  "CREATE_RECURRING_OCCURRENCE",
  "CREATE_SYNTHETIC_SERIES_ANCHOR",
  "RESCHEDULE_BOOKING",
] as const;

export const RESCHEDULE_ASSIGNMENT_HANDLING = [
  "keep_if_available",
  "unassign_if_unavailable",
  "block_if_unavailable",
] as const;

export type RescheduleAssignmentHandling = (typeof RESCHEDULE_ASSIGNMENT_HANDLING)[number];

export type BookingCommandType = (typeof BOOKING_COMMAND_TYPES)[number];

export type BookingCommandActor = {
  actorType: BookingActorType;
  /** profiles.id when the actor is authenticated */
  profileId: string | null;
};

type BaseCommand = {
  actor: BookingCommandActor;
  /** Human-readable justification (required for admin override). */
  reason?: string | null;
  /** Correlates duplicate webhooks / retries; stored on audit when set. */
  idempotencyKey?: string | null;
  /** Extra structured context mirrored to audit.metadata / payload. */
  metadata?: Record<string, unknown> | null;
};

export type CreateBookingDraftCommand = BaseCommand & {
  type: "CREATE_BOOKING_DRAFT";
  customerId: string;
  scheduledStart: string;
  scheduledEnd: string;
  /** Customer total from `calculateQuote()` (ZAR cents). */
  priceCents: number;
  currency?: string;
  serviceId?: string | null;
  /**
   * Persist quote snapshot via `buildBookingQuoteMetadata()` from `@/features/pricing`
   * (e.g. `metadata.quote` on the booking row).
   */
};

export type MarkPaymentPendingCommand = BaseCommand & {
  type: "MARK_PAYMENT_PENDING";
  bookingId: BookingId;
  /** Used to create or upsert the payments row (matches DB idempotency_key). */
  paymentIdempotencyKey: string;
  provider?: string;
};

export type FinalizePaymentSuccessCommand = BaseCommand & {
  type: "FINALIZE_PAYMENT_SUCCESS";
  bookingId: BookingId;
  paymentId: string;
  /** Required. duplicate finalize must reuse the same key (e.g. provider event id). */
  idempotencyKey: string;
};

/** Admin-only. monthly_account draft → confirmed without payment finalization. */
export type ConfirmServiceAuthorizedCommand = BaseCommand & {
  type: "CONFIRM_SERVICE_AUTHORIZED";
  bookingId: BookingId;
  /** Required. dedupe admin authorization retries. */
  idempotencyKey: string;
  reason: string;
};

export type MarkPaymentFailedCommand = BaseCommand & {
  type: "MARK_PAYMENT_FAILED";
  bookingId: BookingId;
  paymentId: string;
  idempotencyKey?: string | null;
};

export type MoveToPendingAssignmentCommand = BaseCommand & {
  type: "MOVE_TO_PENDING_ASSIGNMENT";
  bookingId: BookingId;
};

export type OfferToCleanerCommand = BaseCommand & {
  type: "OFFER_TO_CLEANER";
  bookingId: BookingId;
  cleanerId: string;
  expiresAt?: string | null;
  /** NF-7D: primary (default) or support slot when TEAM_OFFERS_ENABLED. */
  teamRole?: BookingCleanerRole;
};

export type AcceptCleanerAssignmentCommand = BaseCommand & {
  type: "ACCEPT_CLEANER_ASSIGNMENT";
  bookingId: BookingId;
  offerId: string;
};

export type DeclineCleanerAssignmentCommand = BaseCommand & {
  type: "DECLINE_CLEANER_ASSIGNMENT";
  bookingId: BookingId;
  offerId: string;
};

/** Admin-only. withdraw an open assignment offer without booking status change. */
export type CancelOpenAssignmentOfferCommand = BaseCommand & {
  type: "CANCEL_OPEN_ASSIGNMENT_OFFER";
  bookingId: BookingId;
  offerId: string;
};

export type MarkInProgressCommand = BaseCommand & {
  type: "MARK_IN_PROGRESS";
  bookingId: BookingId;
};

export type MarkCompletedCommand = BaseCommand & {
  type: "MARK_COMPLETED";
  bookingId: BookingId;
  /** When true, persists an earning line only if cents are provided (no implicit splits). */
  recordEarningsSnapshot?: boolean;
  earningsSnapshotCents?: number | null;
  earningsCleanerId?: string | null;
};

export type MarkBookingInProgressCommand = BaseCommand & {
  type: "MARK_BOOKING_IN_PROGRESS";
  bookingId: BookingId;
};

export type MarkBookingCompletedCommand = BaseCommand & {
  type: "MARK_BOOKING_COMPLETED";
  bookingId: BookingId;
};

export type MarkBookingPayoutReadyCommand = BaseCommand & {
  type: "MARK_BOOKING_PAYOUT_READY";
  bookingId: BookingId;
};

export type MarkBookingPaidOutCommand = BaseCommand & {
  type: "MARK_BOOKING_PAID_OUT";
  bookingId: BookingId;
  payoutBatchId?: string | null;
};

export type CancelBookingCommand = BaseCommand & {
  type: "CANCEL_BOOKING";
  bookingId: BookingId;
};

export type AdminOverrideStatusCommand = BaseCommand & {
  type: "ADMIN_OVERRIDE_STATUS";
  bookingId: BookingId;
  nextStatus: BookingStatus;
  reason: string;
};

/** System/service only. records assignment outcome in booking.metadata without status change. */
export type RecordAssignmentAttentionCommand = BaseCommand & {
  type: "RECORD_ASSIGNMENT_ATTENTION";
  bookingId: BookingId;
  assignment: import("@/features/assignments/server/types").AssignmentMetadata;
};

/** System/service only. append-only audit when an assignment offer row is already expired. */
export type RecordAssignmentOfferExpiredCommand = BaseCommand & {
  type: "RECORD_ASSIGNMENT_OFFER_EXPIRED";
  bookingId: BookingId;
  offerId: string;
  cleanerId: string;
  expiredAt: string;
};

/** System/service only. guarded offer expiry (status + audit). Cron uses expirySource cron in metadata. */
export type ExpireAssignmentOfferCommand = BaseCommand & {
  type: "EXPIRE_ASSIGNMENT_OFFER";
  bookingId: BookingId;
  offerId: string;
  cleanerId: string;
  expiredAt: string;
};

/** System/service. unpaid child visit for a materialized series (per-visit payment MVP). */
export type CreateRecurringOccurrenceCommand = BaseCommand & {
  type: "CREATE_RECURRING_OCCURRENCE";
  customerId: string;
  seriesId: string;
  scheduledStart: string;
  scheduledEnd: string;
  priceCents: number;
  currency?: string;
  metadata: Record<string, unknown>;
  idempotencyKey: string;
};

/** System/service. cadence anchor only; cancelled + synthetic_anchor, never dispatched. */
export type CreateSyntheticSeriesAnchorCommand = BaseCommand & {
  type: "CREATE_SYNTHETIC_SERIES_ANCHOR";
  customerId: string;
  scheduledStart: string;
  scheduledEnd: string;
  priceCents: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
};

/** Admin-only. updates visit schedule without payment or finalize side effects. */
export type RescheduleBookingCommand = BaseCommand & {
  type: "RESCHEDULE_BOOKING";
  bookingId: BookingId;
  newScheduledStart: string;
  newScheduledEnd: string;
  assignmentHandling: RescheduleAssignmentHandling;
  supportRequestId?: string | null;
};

export type BookingCommand =
  | CreateBookingDraftCommand
  | MarkPaymentPendingCommand
  | FinalizePaymentSuccessCommand
  | ConfirmServiceAuthorizedCommand
  | MarkPaymentFailedCommand
  | MoveToPendingAssignmentCommand
  | OfferToCleanerCommand
  | AcceptCleanerAssignmentCommand
  | DeclineCleanerAssignmentCommand
  | CancelOpenAssignmentOfferCommand
  | MarkInProgressCommand
  | MarkCompletedCommand
  | MarkBookingInProgressCommand
  | MarkBookingCompletedCommand
  | MarkBookingPayoutReadyCommand
  | MarkBookingPaidOutCommand
  | CancelBookingCommand
  | AdminOverrideStatusCommand
  | RecordAssignmentAttentionCommand
  | RecordAssignmentOfferExpiredCommand
  | ExpireAssignmentOfferCommand
  | CreateRecurringOccurrenceCommand
  | CreateSyntheticSeriesAnchorCommand
  | RescheduleBookingCommand;

export type BookingCommandErrorCode =
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "INVALID_PAYLOAD"
  | "BOOKING_NOT_FOUND"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_NOT_PAID"
  | "OFFER_NOT_FOUND"
  | "OFFER_NOT_OPEN"
  | "ASSIGNMENT_CONFLICT"
  | "ASSIGNMENT_UNAVAILABLE"
  | "RECURRING_NOT_SUPPORTED"
  | "OPEN_OFFER_EXISTS"
  | "TERMINAL_STATE"
  | "PERSISTENCE_ERROR"
  | "CONCURRENCY_CONFLICT"
  | "IDEMPOTENCY_REQUIRED"
  | "EARNINGS_NOT_FOUND"
  | "EARNINGS_INVALID"
  | "EARNINGS_RECONCILIATION_BLOCKED"
  | "CLEANER_NOT_OPERATIONAL";

export type BookingCommandFailure = {
  ok: false;
  code: BookingCommandErrorCode;
  message: string;
};

export type BookingCommandSuccess = {
  ok: true;
  bookingId: BookingId;
  status: BookingStatus;
  idempotent: boolean;
};

export type BookingCommandResult = BookingCommandSuccess | BookingCommandFailure;
