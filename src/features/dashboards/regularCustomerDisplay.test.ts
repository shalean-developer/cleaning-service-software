import { describe, expect, it } from "vitest";
import {
  customerRegularCompactGuidance,
  getRegularCustomerBookingDetailCopy,
  getRegularCustomerBookingListCopy,
  getRegularCustomerSuccessCopy,
  isRegularCleaningSlug,
  REGULAR_CLEANING_SLUG,
} from "./regularCustomerDisplay";

describe("regularCustomerDisplay", () => {
  it("recognizes regular service slug", () => {
    expect(isRegularCleaningSlug(REGULAR_CLEANING_SLUG)).toBe(true);
    expect(isRegularCleaningSlug("airbnb-cleaning")).toBe(false);
  });

  it("uses residential list copy", () => {
    const copy = getRegularCustomerBookingListCopy({
      status: "pending_assignment",
      paymentFailureReason: "payment_declined",
      isUpcoming: true,
    });
    expect(copy.statusBadgeLabel).toMatch(/Finding your cleaner/i);
    expect(copy.ctaLabel).toBe("View details");
  });

  it("aligns detail section labels with generic residential UX", () => {
    const copy = getRegularCustomerBookingDetailCopy();
    expect(copy.detailsSectionTitle).toBe("Booking details");
    expect(copy.serviceHeroTitle).toBe("Your scheduled clean");
  });

  it("reuses platform payment success steps for regular cleaning", () => {
    const copy = getRegularCustomerSuccessCopy("confirmed");
    expect(copy.title).toMatch(/scheduled|confirmed/i);
    expect(copy.nextSteps.length).toBeGreaterThan(0);
  });

  it("provides regular compact guidance", () => {
    const guidance = customerRegularCompactGuidance("assigned");
    expect(guidance?.primary).toMatch(/cleaner is confirmed/i);
  });
});
