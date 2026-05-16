import type { PricingInput } from "@/features/pricing/server/types";
import type { BookingLockRow } from "@/lib/database/types";

export type CleanerPreferenceLock = {
  mode: "best_available" | "selected";
  selectedCleanerId: string | null;
};

export type BookingLockInput = {
  checkoutIdempotencyKey: string;
  /** Client-displayed total — must match server recalculation. */
  clientQuoteTotalCents: number;
  pricingInput: PricingInput;
  scheduledStart: string;
  scheduledEnd: string;
  scheduleTimezone?: string;
  areaSlug: string;
  cleanerPreference: CleanerPreferenceLock;
  bookingMetadata: Record<string, unknown>;
};

export type BookingPaymentLockSuccess = {
  ok: true;
  lockId: string;
  bookingId: string;
  lockedPriceCents: number;
  currency: string;
  expiresAt: string;
  paymentIdempotencyKey: string;
  idempotent: boolean;
};

export type BookingLockErrorCode =
  | "QUOTE_MISMATCH"
  | "LOCK_EXPIRED"
  | "LOCK_INPUT_MISMATCH"
  | "INVALID_SCHEDULE"
  | "CLEANER_INELIGIBLE"
  | "FORBIDDEN"
  | "INVALID_PAYLOAD"
  | "PERSISTENCE_ERROR"
  | "LOCK_NOT_FOUND"
  | "LOCK_NOT_ACTIVE";

export type BookingPaymentLockFailure = {
  ok: false;
  code: BookingLockErrorCode;
  message: string;
  status: number;
};

export type BookingPaymentLockResult = BookingPaymentLockSuccess | BookingPaymentLockFailure;

export type ActiveBookingLock = BookingLockRow & {
  isExpired: boolean;
};
