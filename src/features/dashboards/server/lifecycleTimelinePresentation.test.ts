import { describe, expect, it } from "vitest";
import {
  humanAuditCommandTitle,
  humanPaymentEventTitle,
} from "./lifecycleTimelinePresentation";

describe("lifecycleTimelinePresentation", () => {
  it("maps known commands to human titles for customer", () => {
    expect(humanAuditCommandTitle("MARK_PAYMENT_FAILED", "payment_failed", "customer", null)).toBe(
      "Payment failed",
    );
    expect(humanAuditCommandTitle("MARK_COMPLETED", "completed", "customer", null)).toBe(
      "Booking completed",
    );
    expect(humanAuditCommandTitle("RECORD_ASSIGNMENT_OFFER_EXPIRED", null, "customer", null)).toBe(
      "Offer expired",
    );
  });

  it("returns null command title for admin (detail carries command)", () => {
    expect(humanAuditCommandTitle("MARK_PAYMENT_FAILED", "payment_failed", "admin", null)).toBeNull();
  });

  it("humanizes paid payment events for cleaner", () => {
    expect(humanPaymentEventTitle("paid", "cleaner")).toBe("Payment confirmed");
  });
});
