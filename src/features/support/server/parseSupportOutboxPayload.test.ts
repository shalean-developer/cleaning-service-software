import { describe, expect, it } from "vitest";
import { parseSupportOutboxPayload } from "./parseSupportOutboxPayload";

describe("parseSupportOutboxPayload", () => {
  it("parses Phase 3 enqueue payload shape", () => {
    const parsed = parseSupportOutboxPayload({
      template: "support_request_created",
      event: "support_request_created",
      dedupeKey: "support_request:booking_support:r1:open",
      requestId: "r1",
      source: "booking_support",
      requestType: "reschedule",
      requestStatus: "open",
      customerId: "c1",
      ctaPath: "/customer/bookings/b1#booking-support",
      bookingId: "b1",
      subject: "We received your Shalean support request",
      text: "Hi",
      html: "<p>Hi</p>",
    });

    expect(parsed?.template).toBe("support_request_created");
    expect(parsed?.dedupeKey).toBe("support_request:booking_support:r1:open");
    expect(parsed?.subject).toBe("We received your Shalean support request");
  });

  it("returns null for unsupported template", () => {
    expect(parseSupportOutboxPayload({ template: "payment_confirmed", bookingId: "b1" })).toBeNull();
  });

  it("returns null when required fields missing", () => {
    expect(
      parseSupportOutboxPayload({
        template: "support_request_created",
        requestId: "r1",
      }),
    ).toBeNull();
  });
});
