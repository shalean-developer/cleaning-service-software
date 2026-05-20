import { describe, expect, it } from "vitest";
import {
  customerMovingCompactGuidance,
  getMovingCustomerBookingListCopy,
  getMovingCustomerSuccessCopy,
  isMovingCleaningService,
  parseMovingPaymentReturnServiceSlug,
} from "./movingCustomerDisplay";

describe("movingCustomerDisplay", () => {
  it("recognizes moving service slug", () => {
    expect(isMovingCleaningService("moving-cleaning")).toBe(true);
    expect(isMovingCleaningService("airbnb-cleaning")).toBe(false);
  });

  it("parses payment return service param", () => {
    expect(parseMovingPaymentReturnServiceSlug("moving-cleaning")).toBe("moving-cleaning");
    expect(parseMovingPaymentReturnServiceSlug("regular-cleaning")).toBeNull();
  });

  it("uses move preparation list copy", () => {
    const copy = getMovingCustomerBookingListCopy({
      status: "confirmed",
      paymentFailureReason: "payment_declined",
      isUpcoming: true,
    });
    expect(copy.statusBadgeLabel).toBe("Move preparation scheduled");
    expect(copy.serviceSubtitle).toMatch(/Move preparation/i);
    expect(copy.ctaLabel).toBe("View move details");
  });

  it("avoids turnover wording in success copy", () => {
    const copy = getMovingCustomerSuccessCopy("confirmed");
    expect(copy.title).toMatch(/move cleaning is scheduled/i);
    expect(copy.lead).toMatch(/move-in|inspection/i);
    expect(JSON.stringify(copy.nextSteps)).not.toMatch(/turnover|guest-ready/i);
  });

  it("provides handover-focused compact guidance", () => {
    const guidance = customerMovingCompactGuidance("assigned");
    expect(guidance?.primary).toMatch(/handover/i);
  });
});
