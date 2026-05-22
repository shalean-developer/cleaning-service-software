import { describe, expect, it } from "vitest";
import {
  assertNoMisleadingBookingMutationCopy,
  buildSupportCustomerNotificationEmail,
  supportRequestTypeDisclaimer,
} from "./supportNotificationTemplates";

describe("supportNotificationTemplates", () => {
  it("uses safe created/acknowledged/resolved/rejected copy", () => {
    const events = [
      "support_request_created",
      "support_request_acknowledged",
      "support_request_resolved",
      "support_request_rejected",
    ] as const;

    for (const event of events) {
      const email = buildSupportCustomerNotificationEmail({
        event,
        requestTypeLabel: "Request reschedule",
        requestType: "reschedule",
        customerName: "Jane",
        messagePreview: "Please move visit",
        customerResponse: null,
        ctaUrl: "https://example.com/customer/bookings/x",
      });
      expect(email.subject.length).toBeGreaterThan(5);
      expect(assertNoMisleadingBookingMutationCopy(email.text)).toBe(true);
      expect(assertNoMisleadingBookingMutationCopy(email.html)).toBe(true);
    }
  });

  it("includes reschedule/cancel/payment disclaimers without mutation claims", () => {
    expect(supportRequestTypeDisclaimer("reschedule")).toContain("not confirmed");
    expect(supportRequestTypeDisclaimer("cancel")).toContain("does not automatically cancel");
    expect(supportRequestTypeDisclaimer("payment_help")).toContain("may still need action");
  });

  it("includes customer_response in resolved email when present", () => {
    const email = buildSupportCustomerNotificationEmail({
      event: "support_request_resolved",
      requestTypeLabel: "Payment help",
      requestType: "payment_help",
      customerName: null,
      messagePreview: null,
      customerResponse: "We sent a payment link.",
      ctaUrl: "https://example.com/booking",
    });
    expect(email.text).toContain("We sent a payment link.");
    expect(email.text).not.toContain("admin_notes");
  });
});
