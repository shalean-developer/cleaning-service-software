import { describe, expect, it } from "vitest";
import {
  MOVING_ADDON_STEP_DISPLAY_ORDER,
  MOVING_SERVICE_STEP_DESCRIPTION_MOBILE,
  buildMovingReviewHeroSegments,
  getMovingCleaningCheckoutCopy,
  getMovingCleaningReviewCopy,
  getMovingCleaningStepCopy,
  getMovingFrequencyStepOptions,
  isMovingCleaningSlug,
} from "./movingCleaningDisplay";
import { getAddonStepDisplayOrder } from "./addonStepDisplay";
import { getDetailsStepIntro } from "./airbnbCleaningDisplay";

describe("movingCleaningDisplay", () => {
  it("identifies moving-cleaning slug", () => {
    expect(isMovingCleaningSlug("moving-cleaning")).toBe(true);
    expect(isMovingCleaningSlug("regular-cleaning")).toBe(false);
    expect(isMovingCleaningSlug("airbnb-cleaning")).toBe(false);
  });

  it("exposes move-ready step 1 copy", () => {
    const step = getMovingCleaningStepCopy("moving-cleaning");
    expect(step?.mobileDescription).toBe(MOVING_SERVICE_STEP_DESCRIPTION_MOBILE);
    expect(step?.desktopDescription).toMatch(/handover|move-in/i);
    expect(step?.desktopDescription).not.toMatch(/turnover|guest-ready/i);
  });

  it("shows only deep/move add-ons in the step panel order", () => {
    expect(MOVING_ADDON_STEP_DISPLAY_ORDER).toEqual([
      "balcony",
      "carpet-addon",
      "ceiling-cleaning",
      "garage-cleaning",
      "mattress-cleaning",
      "outside-windows",
      "couch-cleaning",
    ]);
    expect(getAddonStepDisplayOrder("moving-cleaning")).toEqual(MOVING_ADDON_STEP_DISPLAY_ORDER);
  });

  it("uses move preparation details intro via router", () => {
    const intro = getDetailsStepIntro("moving-cleaning");
    expect(intro.title).toBe("Property & move preparation");
    expect(intro.description).toMatch(/handover/i);
    expect(intro.description).not.toMatch(/turnover/i);
  });

  it("softens recurring frequency labels without changing values", () => {
    const options = getMovingFrequencyStepOptions("moving-cleaning");
    expect(options?.find((o) => o.value === "once")?.label).toBe("One-time move clean");
    expect(options?.find((o) => o.value === "weekly")?.value).toBe("weekly");
  });

  it("builds compact review hero with schedule first and no add-ons or frequency", () => {
    const segments = buildMovingReviewHeroSegments({
      scheduleLabel: "Mon 10:00",
      locationLabel: "Sea Point, Cape Town",
      bedBathSummary: "2 beds · 1 bath",
      addonSummary: "Inside oven",
      frequencyLabel: "One-time move clean",
    });
    expect(segments).toEqual(["Mon 10:00", "Sea Point, Cape Town", "2 beds · 1 bath"]);
  });

  it("provides checkout copy without turnover language", () => {
    const checkout = getMovingCleaningCheckoutCopy("moving-cleaning");
    expect(checkout?.whatHappensNext[0]).toMatch(/Move cleaning scheduled/i);
    expect(checkout?.guestReadyNote).toMatch(/move-in|handover|inspection/i);
  });

  it("does not apply moving copy to other services", () => {
    expect(getMovingCleaningStepCopy("deep-cleaning")).toBeNull();
    expect(getMovingCleaningReviewCopy("airbnb-cleaning")).toBeNull();
    expect(getMovingCleaningCheckoutCopy("regular-cleaning")).toBeNull();
  });

  it("does not apply moving copy to deep cleaning (deep has its own module)", () => {
    expect(getMovingCleaningStepCopy("deep-cleaning")).toBeNull();
    expect(getMovingCleaningReviewCopy("deep-cleaning")).toBeNull();
  });
});
