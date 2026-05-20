import { describe, expect, it } from "vitest";
import {
  customerDeepCompactGuidance,
  getDeepCustomerBookingListCopy,
  getDeepCustomerSuccessCopy,
  isDeepCleaningService,
  parseDeepPaymentReturnServiceSlug,
} from "./deepCustomerDisplay";

const FORBIDDEN_LEAKAGE = /turnover|guest-ready|handover|move preparation/i;

describe("deepCustomerDisplay", () => {
  it("recognizes deep service slug", () => {
    expect(isDeepCleaningService("deep-cleaning")).toBe(true);
    expect(isDeepCleaningService("airbnb-cleaning")).toBe(false);
    expect(isDeepCleaningService("moving-cleaning")).toBe(false);
  });

  it("parses payment return service param", () => {
    expect(parseDeepPaymentReturnServiceSlug("deep-cleaning")).toBe("deep-cleaning");
    expect(parseDeepPaymentReturnServiceSlug("regular-cleaning")).toBeNull();
  });

  it("uses restoration-focused list copy", () => {
    const copy = getDeepCustomerBookingListCopy({
      status: "confirmed",
      paymentFailureReason: "payment_declined",
      isUpcoming: true,
    });
    expect(copy.statusBadgeLabel).toBe("Deep-clean preparation scheduled");
    expect(copy.serviceSubtitle).toMatch(/Deep-clean|restoration/i);
    expect(copy.ctaLabel).toBe("View deep clean details");
    expect(JSON.stringify(copy)).not.toMatch(FORBIDDEN_LEAKAGE);
  });

  it("avoids turnover wording in success copy", () => {
    const copy = getDeepCustomerSuccessCopy("confirmed");
    expect(copy.title).toMatch(/deep cleaning is scheduled/i);
    expect(copy.lead).toMatch(/restoration-focused/i);
    expect(JSON.stringify(copy.nextSteps)).not.toMatch(FORBIDDEN_LEAKAGE);
  });

  it("provides restoration-focused compact guidance", () => {
    const guidance = customerDeepCompactGuidance("assigned");
    expect(guidance?.primary).toMatch(/priority areas|fragile/i);
  });
});
