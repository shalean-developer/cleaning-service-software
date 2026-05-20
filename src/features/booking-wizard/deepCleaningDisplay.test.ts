import { describe, expect, it } from "vitest";
import {
  DEEP_ADDON_STEP_DISPLAY_ORDER,
  DEEP_SERVICE_STEP_DESCRIPTION_MOBILE,
  buildDeepReviewHeroSegments,
  getDeepCleaningCheckoutCopy,
  getDeepCleaningReviewCopy,
  getDeepCleaningStepCopy,
  getDeepFrequencyStepOptions,
  isDeepCleaningSlug,
} from "./deepCleaningDisplay";
import { getAddonStepDisplayOrder } from "./addonStepDisplay";
import { getDetailsStepIntro } from "./airbnbCleaningDisplay";

const FORBIDDEN_LEAKAGE = /turnover|guest-ready|handover|move-in|move preparation|inspection-ready/i;
const REGULAR_LEAKAGE = /routine upkeep|team support|cleaning intensity/i;

describe("deepCleaningDisplay", () => {
  it("identifies deep-cleaning slug", () => {
    expect(isDeepCleaningSlug("deep-cleaning")).toBe(true);
    expect(isDeepCleaningSlug("regular-cleaning")).toBe(false);
    expect(isDeepCleaningSlug("airbnb-cleaning")).toBe(false);
    expect(isDeepCleaningSlug("moving-cleaning")).toBe(false);
  });

  it("exposes restoration-focused step 1 copy", () => {
    const step = getDeepCleaningStepCopy("deep-cleaning");
    expect(step?.mobileDescription).toBe(DEEP_SERVICE_STEP_DESCRIPTION_MOBILE);
    expect(step?.desktopDescription).toMatch(/restoration|buildup|seasonal/i);
    expect(step?.desktopDescription).not.toMatch(FORBIDDEN_LEAKAGE);
  });

  it("orders restoration-focused add-ons before laundry", () => {
    expect(DEEP_ADDON_STEP_DISPLAY_ORDER.indexOf("inside-cabinets")).toBeLessThan(
      DEEP_ADDON_STEP_DISPLAY_ORDER.indexOf("laundry"),
    );
    expect(getAddonStepDisplayOrder("deep-cleaning")).toEqual(DEEP_ADDON_STEP_DISPLAY_ORDER);
  });

  it("uses home restoration details intro via router", () => {
    const intro = getDetailsStepIntro("deep-cleaning");
    expect(intro.title).toBe("Home restoration details");
    expect(intro.description).toMatch(/intensive|restoration|buildup/i);
    expect(intro.description).not.toMatch(FORBIDDEN_LEAKAGE);
  });

  it("softens recurring frequency labels without changing values", () => {
    const options = getDeepFrequencyStepOptions("deep-cleaning");
    expect(options?.find((o) => o.value === "once")?.label).toBe("One-time deep clean");
    expect(options?.find((o) => o.value === "weekly")?.value).toBe("weekly");
  });

  it("builds review hero with schedule first", () => {
    const segments = buildDeepReviewHeroSegments({
      scheduleLabel: "Mon 10:00",
      locationLabel: "Sea Point, Cape Town",
      bedBathSummary: "2 beds · 1 bath",
      addonSummary: "Inside oven",
      frequencyLabel: "One-time deep clean",
    });
    expect(segments[0]).toBe("Mon 10:00");
    expect(segments.join(" · ")).toMatch(/Sea Point/);
  });

  it("provides checkout copy without turnover or move language", () => {
    const checkout = getDeepCleaningCheckoutCopy("deep-cleaning");
    expect(checkout?.whatHappensNext[0]).toMatch(/deep cleaning is scheduled/i);
    expect(checkout?.restorationNote).toMatch(/restoration-focused/i);
    expect(JSON.stringify(checkout)).not.toMatch(FORBIDDEN_LEAKAGE);
  });

  it("uses deep-clean review labels", () => {
    const review = getDeepCleaningReviewCopy("deep-cleaning");
    expect(review?.addonsSectionLabel).toBe("Detailed cleaning extras");
    expect(review?.propertySectionTitle).toBe("Deep-clean priorities");
    expect(review?.propertySectionTitle).not.toMatch(REGULAR_LEAKAGE);
  });

  it("does not apply deep copy to other services", () => {
    expect(getDeepCleaningStepCopy("airbnb-cleaning")).toBeNull();
    expect(getDeepCleaningReviewCopy("moving-cleaning")).toBeNull();
    expect(getDeepCleaningCheckoutCopy("regular-cleaning")).toBeNull();
  });
});
