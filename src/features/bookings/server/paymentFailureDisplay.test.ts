import { describe, expect, it } from "vitest";
import {
  canRetryPaymentOnExistingBooking,
  CHECKOUT_EXPIRED_FAILURE_REASON,
  isUpcomingCustomerBooking,
  labelForAdminPaymentFailureAttention,
  labelForCustomerBookingStatus,
  normalizePaymentFailureReasonParam,
  PAYSTACK_DECLINED_FAILURE_REASON,
  paymentIssuePanelCopy,
  resolvePaymentFailureReason,
  showsPrePaymentAssignmentExpectation,
} from "./paymentFailureDisplay";
import { labelForBookingStatus } from "./statusLabels";

describe("paymentFailureDisplay", () => {
  it("resolves checkout_expired from MARK_PAYMENT_FAILED audit metadata", () => {
    const reason = resolvePaymentFailureReason([
      {
        command: "MARK_PAYMENT_FAILED",
        created_at: "2026-05-16T12:00:00.000Z",
        metadata: { failure_reason: CHECKOUT_EXPIRED_FAILURE_REASON },
      },
    ]);
    expect(reason).toBe(CHECKOUT_EXPIRED_FAILURE_REASON);
  });

  it("uses generic payment_failed label without failure_reason", () => {
    expect(labelForCustomerBookingStatus("payment_failed", null)).toBe("Payment failed");
    expect(paymentIssuePanelCopy(null).body).toContain("could not confirm payment");
  });

  it("uses paystack_declined copy in payment issue panel", () => {
    expect(paymentIssuePanelCopy(PAYSTACK_DECLINED_FAILURE_REASON).body).toContain("declined");
  });

  it("normalizePaymentFailureReasonParam allows only known reasons", () => {
    expect(normalizePaymentFailureReasonParam(CHECKOUT_EXPIRED_FAILURE_REASON)).toBe(
      CHECKOUT_EXPIRED_FAILURE_REASON,
    );
    expect(normalizePaymentFailureReasonParam(PAYSTACK_DECLINED_FAILURE_REASON)).toBe(
      PAYSTACK_DECLINED_FAILURE_REASON,
    );
    expect(normalizePaymentFailureReasonParam("processor_error")).toBeNull();
  });

  it("uses checkout expired copy when metadata has failure_reason", () => {
    expect(
      labelForCustomerBookingStatus("payment_failed", CHECKOUT_EXPIRED_FAILURE_REASON),
    ).toBe("Checkout expired");
    expect(
      paymentIssuePanelCopy(CHECKOUT_EXPIRED_FAILURE_REASON).body,
    ).toContain("checkout link expired");
    expect(labelForAdminPaymentFailureAttention(CHECKOUT_EXPIRED_FAILURE_REASON)).toBe(
      "Checkout expired",
    );
  });

  it("treats payment_failed as not an upcoming customer job", () => {
    expect(isUpcomingCustomerBooking("payment_failed")).toBe(false);
    expect(isUpcomingCustomerBooking("assigned")).toBe(true);
  });

  it("hides pre-payment assignment expectation for payment_failed", () => {
    expect(showsPrePaymentAssignmentExpectation("payment_failed")).toBe(false);
    expect(showsPrePaymentAssignmentExpectation("pending_payment")).toBe(true);
  });

  it("shows Completed for customer payout terminal statuses", () => {
    expect(labelForCustomerBookingStatus("payout_ready", null)).toBe("Completed");
    expect(labelForCustomerBookingStatus("paid_out", null)).toBe("Completed");
    expect(labelForBookingStatus("payout_ready")).toBe("Payout ready");
  });

  it("enables production retry UI when booking lock is required", () => {
    const prev = process.env.BOOKING_LOCK_REQUIRED;
    process.env.BOOKING_LOCK_REQUIRED = "true";
    expect(canRetryPaymentOnExistingBooking()).toBe(true);
    process.env.BOOKING_LOCK_REQUIRED = "false";
    expect(canRetryPaymentOnExistingBooking()).toBe(false);
    if (prev === undefined) delete process.env.BOOKING_LOCK_REQUIRED;
    else process.env.BOOKING_LOCK_REQUIRED = prev;
  });
});
