import { describe, expect, it } from "vitest";
import {
  buildPaymentConfirmedEmail,
  shortBookingReference,
} from "./paymentConfirmed";

describe("paymentConfirmed email template", () => {
  it("builds safe customer-facing copy without admin details", () => {
    const bookingId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const content = buildPaymentConfirmedEmail({
      booking: {
        id: bookingId,
        scheduled_start: "2026-06-01T08:00:00.000Z",
        scheduled_end: "2026-06-01T10:00:00.000Z",
        metadata: {
          quote: {
            input: { serviceSlug: "standard-cleaning" },
          },
        },
      },
      customerDisplayName: "Sam",
      bookingDetailUrl: "https://app.example.com/customer/bookings/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      supportEmail: "help@shalean.co.za",
    });

    expect(content.subject).toContain("Payment confirmed");
    expect(content.text).toContain("Hi Sam,");
    expect(content.text).toContain(shortBookingReference(bookingId));
    expect(content.text).toContain("assign a cleaner");
    expect(content.text).not.toMatch(/attention_required/i);
    expect(content.text).not.toMatch(/dispatch/i);
    expect(content.html).toContain("help@shalean.co.za");
  });
});
