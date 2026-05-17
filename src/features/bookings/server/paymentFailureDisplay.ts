import type { BookingStateAuditRow } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import { isBookingLockRequired } from "@/features/bookings/server/lock/constants";
import { labelForBookingStatus } from "./statusLabels";

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
      return "Checkout expired";
    }
    return "Payment failed";
  }
  if (status === "payout_ready" || status === "paid_out") {
    return "Completed";
  }
  return labelForBookingStatus(status);
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
      body: "Your checkout link expired before payment was completed.",
    };
  }
  if (paymentFailureReason === PAYSTACK_DECLINED_FAILURE_REASON) {
    return {
      title: "Payment not completed",
      body: "Your bank or card provider declined this payment. You can try again from your booking when retry is available.",
    };
  }
  return {
    title: "Payment not completed",
    body: "We could not confirm payment for this booking.",
  };
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
  "No cleaner is assigned until payment succeeds." as const;

export const PAYMENT_FAILED_RETRY_GUIDANCE =
  "Open your booking to retry payment when the Retry payment button is shown." as const;

export const PAYMENT_FAILED_SUPPORT_NOTE =
  "If you are unsure whether you were charged, check My bookings or contact support with your booking reference." as const;

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
