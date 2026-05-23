import { describe, expect, it } from "vitest";
import {
  ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE,
  buildAdminAssistedPaymentRequestEmail,
  buildAdminAssistedPaymentRequestWhatsAppCopy,
} from "./adminAssistedPaymentRequest";

describe("adminAssistedPaymentRequest template", () => {
  const booking = {
    id: "book-1",
    scheduled_start: "2026-06-01T07:00:00.000Z",
    scheduled_end: "2026-06-01T10:00:00.000Z",
    price_cents: 45000,
    currency: "ZAR",
    metadata: {
      display: { serviceSlug: "regular-cleaning", serviceLabel: "Regular cleaning" },
    },
  };

  const input = {
    booking,
    customerDisplayName: "Jane Doe",
    paymentUrl: "https://checkout.paystack.com/abc123",
    expiresAt: "2026-06-02T07:00:00.000Z",
    supportEmail: "support@shalean.co.za",
    optionalMessage: "Please pay today",
  };

  it("uses admin_assisted_payment_request_sent event name", () => {
    expect(ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE).toBe(
      "admin_assisted_payment_request_sent",
    );
  });

  it("builds email with required subject and fields", () => {
    const email = buildAdminAssistedPaymentRequestEmail(input);
    expect(email.subject).toBe("Payment request for your Shalean cleaning booking");
    expect(email.text).toContain("Jane Doe");
    expect(email.text).toContain("https://checkout.paystack.com/abc123");
    expect(email.text).toContain("Cleaning service");
    expect(email.text).toContain("Please pay today");
    expect(email.html).toContain("support@shalean.co.za");
  });

  it("builds WhatsApp copy with payment URL and expiry", () => {
    const copy = buildAdminAssistedPaymentRequestWhatsAppCopy(input);
    expect(copy).toContain("Pay securely here:");
    expect(copy).toContain("https://checkout.paystack.com/abc123");
    expect(copy).toContain("Link expires:");
  });
});
