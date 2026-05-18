import { describe, expect, it } from "vitest";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
  PAYSTACK_DECLINED_FAILURE_REASON,
} from "@/features/bookings/server/paymentFailureDisplay";
import { buildBookingQuoteMetadata } from "@/features/pricing/server/metadata";
import {
  buildPaymentFailedEmail,
  subjectForPaymentFailedEmail,
} from "./paymentFailed";
import { shortBookingReference } from "./paymentConfirmed";

const bookingId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function bookingSnapshot() {
  const metadata = buildBookingQuoteMetadata(
    { serviceSlug: "regular-cleaning", bedrooms: 2, bathrooms: 1 },
    {
      pricingVersion: "2026-05-16-mvp",
      currency: "ZAR",
      serviceSlug: "regular-cleaning",
      lineItems: [],
      subtotalCents: 53_000,
      discountCents: 0,
      totalCents: 53_000,
      frequency: "once",
      cleanerEarnings: {
        perCleanerAmountCents: 25_000,
        teamSize: 1,
        totalCleanerPayoutCents: 25_000,
        ruleApplied: "test",
        metadata: {},
      },
      metadata: {},
    },
  );
  return {
    id: bookingId,
    scheduled_start: "2026-06-01T08:00:00.000Z",
    scheduled_end: "2026-06-01T10:00:00.000Z",
    metadata: { ...metadata, suburb: "Sea Point" },
  };
}

describe("paymentFailed email template", () => {
  it("uses checkout_expired subject and copy", () => {
    expect(subjectForPaymentFailedEmail(CHECKOUT_EXPIRED_FAILURE_REASON)).toBe(
      "Your Shalean payment link expired",
    );
    const content = buildPaymentFailedEmail({
      booking: bookingSnapshot(),
      failureReason: CHECKOUT_EXPIRED_FAILURE_REASON,
      canRetry: true,
      customerDisplayName: "Sam",
      bookingDetailUrl: `https://app.example.com/customer/bookings/${bookingId}`,
      supportEmail: null,
    });
    expect(content.text).toContain("checkout link expired");
    expect(content.text).toContain("retry payment on the same booking");
    expect(content.text).not.toMatch(/paystack/i);
    expect(content.text).not.toMatch(/gateway/i);
  });

  it("uses generic copy for paystack_declined", () => {
    expect(subjectForPaymentFailedEmail(PAYSTACK_DECLINED_FAILURE_REASON)).toBe(
      "Payment was not completed for your Shalean booking",
    );
    const content = buildPaymentFailedEmail({
      booking: bookingSnapshot(),
      failureReason: PAYSTACK_DECLINED_FAILURE_REASON,
      canRetry: false,
      customerDisplayName: null,
      bookingDetailUrl: `https://app.example.com/customer/bookings/${bookingId}`,
      supportEmail: "help@shalean.co.za",
    });
    expect(content.text).toContain("declined this payment");
    expect(content.text).toContain("start a new booking");
    expect(content.text).not.toContain("retry payment on the same booking");
    expect(content.text).toContain(shortBookingReference(bookingId));
    expect(content.text).not.toMatch(/paystack_reference/i);
    expect(content.text).not.toMatch(/attention_required/i);
  });

  it("uses generic copy when failure reason is missing", () => {
    const content = buildPaymentFailedEmail({
      booking: bookingSnapshot(),
      failureReason: null,
      canRetry: false,
      customerDisplayName: "Alex",
      bookingDetailUrl: `https://app.example.com/customer/bookings/${bookingId}`,
      supportEmail: null,
    });
    expect(content.subject).toBe("Payment was not completed for your Shalean booking");
    expect(content.text).toContain("could not confirm payment");
    expect(content.text).toContain("No cleaner is assigned");
  });
});
