import type { BookingStateAuditRow, PaymentStatus } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import { isBookingLockRequired } from "@/features/bookings/server/lock/constants";
import { labelForBookingStatus } from "./statusLabels";

/** Customer-facing assignment state (list, hero, guidance). */
export const CUSTOMER_FINDING_CLEANER_LABEL = "Finding your cleaner" as const;

/** Known `metadata.failure_reason` from `MARK_PAYMENT_FAILED` (cron / future webhooks). */
export const CHECKOUT_EXPIRED_FAILURE_REASON = "checkout_expired";

/** Paystack `charge.failed` webhook (`MARK_PAYMENT_FAILED` from processPaystackChargeFailure). */
export const PAYSTACK_DECLINED_FAILURE_REASON = "paystack_declined";

export type PaymentFailureReason = string | null;

function readFailureReasonFromMetadata(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const reason = (metadata as Record<string, unknown>).failure_reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

/** Latest `MARK_PAYMENT_FAILED` audit metadata, newest first. */
export function resolvePaymentFailureReason(
  audits: Pick<BookingStateAuditRow, "command" | "metadata" | "created_at">[],
): PaymentFailureReason {
  const failureAudits = [...audits]
    .filter((a) => a.command === "MARK_PAYMENT_FAILED")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  for (const audit of failureAudits) {
    const reason = readFailureReasonFromMetadata(audit.metadata);
    if (reason) return reason;
  }

  return null;
}

export function labelForCustomerBookingStatus(
  status: BookingStatus,
  paymentFailureReason?: PaymentFailureReason,
): string {
  if (status === "payment_failed") {
    if (paymentFailureReason === CHECKOUT_EXPIRED_FAILURE_REASON) {
      return "Checkout not completed";
    }
    return "Payment not completed";
  }
  if (status === "payout_ready" || status === "paid_out") {
    return "Completed";
  }
  if (status === "pending_assignment") {
    return CUSTOMER_FINDING_CLEANER_LABEL;
  }
  return labelForBookingStatus(status);
}

/** Customer-facing payment chip and list lines (never admin/internal wording). */
export function labelForCustomerPaymentStatus(status: PaymentStatus | null): string {
  if (!status) return "Payment pending";
  switch (status) {
    case "paid":
      return "Paid";
    case "initialized":
    case "pending":
      return "Payment pending";
    case "failed":
    case "refunded":
      return "Payment not completed";
    default:
      return "Payment pending";
  }
}

export function labelForAdminPaymentFailureAttention(
  paymentFailureReason?: PaymentFailureReason,
): string {
  if (paymentFailureReason === CHECKOUT_EXPIRED_FAILURE_REASON) {
    return "Checkout expired";
  }
  return "Payment failed";
}

export type PaymentIssueCopy = {
  title: string;
  body: string;
};

export function paymentIssuePanelCopy(
  paymentFailureReason?: PaymentFailureReason,
): PaymentIssueCopy {
  if (paymentFailureReason === CHECKOUT_EXPIRED_FAILURE_REASON) {
    return {
      title: "Payment not completed",
      body: "Your checkout timed out before payment finished. Open your booking to complete payment when retry is available.",
    };
  }
  if (paymentFailureReason === PAYSTACK_DECLINED_FAILURE_REASON) {
    return {
      title: "Payment not completed",
      body: "Your bank or card provider did not complete this payment. You can try again from your booking when retry is available.",
    };
  }
  return {
    title: "Payment not completed",
    body: "We could not confirm payment for this booking yet. Open your booking to complete checkout when retry is available.",
  };
}

/** Primary reassurance shown on payment issue surfaces (detail panel, failed return page). */
export const PAYMENT_NOT_CHARGED_REASSURANCE =
  "You were not charged. You can safely try again or contact support if the issue continues." as const;

export const PAYMENT_RETRY_NOT_ELIGIBLE_NEXT_STEP =
  "Please start a new booking or contact support." as const;

export const PAYMENT_RETRY_NOT_ELIGIBLE_EXPLANATION =
  "Retry is not available for this booking. Please start a new booking or contact support." as const;

export const PAYMENT_RETRY_FRESH_CHECKOUT_HINT =
  "Retry payment opens a fresh secure checkout for this booking." as const;

/** Reassurance line for payment issue UI; varies when same-booking retry is unavailable. */
export function paymentIssuePanelReassurance(canRetryPayment: boolean): string {
  if (canRetryPayment) {
    return PAYMENT_NOT_CHARGED_REASSURANCE;
  }
  return `You were not charged. ${PAYMENT_RETRY_NOT_ELIGIBLE_NEXT_STEP}`;
}

/** Maps URL `reason` to a known failure reason; unknown values are ignored (never shown raw). */
export function normalizePaymentFailureReasonParam(
  reason: string | undefined | null,
): PaymentFailureReason {
  const trimmed = reason?.trim();
  if (!trimmed) return null;
  if (trimmed === CHECKOUT_EXPIRED_FAILURE_REASON) return CHECKOUT_EXPIRED_FAILURE_REASON;
  if (trimmed === PAYSTACK_DECLINED_FAILURE_REASON) return PAYSTACK_DECLINED_FAILURE_REASON;
  return null;
}

export const PAYMENT_FAILED_ASSIGNMENT_NOTE =
  "Complete checkout to confirm your booking and assign a cleaner." as const;

export const PAYMENT_FAILED_RETRY_GUIDANCE =
  "Open your booking and use Retry payment for a fresh secure checkout." as const;

export const PAYMENT_FAILED_SUPPORT_NOTE =
  "You were not charged. Check your booking to retry, or contact support with your booking reference." as const;

/** Bookings the customer should treat as scheduled/upcoming work (paid path). */
export function isUpcomingCustomerBooking(status: BookingStatus): boolean {
  return (
    status === "confirmed" ||
    status === "pending_assignment" ||
    status === "assigned" ||
    status === "in_progress"
  );
}

export function showsPrePaymentAssignmentExpectation(status: BookingStatus): boolean {
  return status !== "payment_failed" && status !== "draft" && status !== "cancelled";
}

/**
 * Production same-booking retry uses retry-lock + initialize (requires checkout locks).
 * When locks are disabled (legacy dev only), direct initialize without retry-lock is used.
 */
export function canRetryPaymentOnExistingBooking(): boolean {
  return isBookingLockRequired();
}
