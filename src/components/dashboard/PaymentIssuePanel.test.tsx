import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
  PAYMENT_NOT_CHARGED_REASSURANCE,
  PAYMENT_RETRY_FRESH_CHECKOUT_HINT,
  PAYMENT_RETRY_NOT_ELIGIBLE_EXPLANATION,
} from "@/features/bookings/server/paymentFailureDisplay";
import { PaymentIssuePanel } from "./PaymentIssuePanel";

const bookingId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

describe("PaymentIssuePanel", () => {
  it("renders reassurance and retry CTA when retry is allowed", () => {
    const html = renderToStaticMarkup(
      <PaymentIssuePanel
        bookingId={bookingId}
        customerEmail="customer@example.com"
        paymentFailureReason={null}
        canRetryPayment
      />,
    );

    expect(html).toContain(PAYMENT_NOT_CHARGED_REASSURANCE);
    expect(html).toContain("Payment details");
    expect(html).toContain("Retry payment");
    expect(html).not.toContain(PAYMENT_RETRY_NOT_ELIGIBLE_EXPLANATION);
  });

  it("renders next-step guidance when retry is not allowed", () => {
    const html = renderToStaticMarkup(
      <PaymentIssuePanel
        bookingId={bookingId}
        customerEmail="customer@example.com"
        paymentFailureReason={CHECKOUT_EXPIRED_FAILURE_REASON}
        canRetryPayment={false}
      />,
    );

    expect(html).toContain("You were not charged. Please start a new booking or contact support.");
    expect(html).toContain("Payment details");
    expect(html).not.toContain("Retry payment");
    expect(html).toContain("Start a new booking");
  });
});
