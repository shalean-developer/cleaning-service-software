import { describe, expect, it } from "vitest";
import {
  getOfficeCleaningCheckoutCopy,
  getOfficeCleaningReviewCopy,
  getOfficeCleaningStepCopy,
  getOfficeFrequencyStepOptions,
  isOfficeCleaningSlug,
  OFFICE_SERVICE_STEP_DESCRIPTION_DESKTOP,
  OFFICE_SERVICE_STEP_DESCRIPTION_MOBILE,
} from "./officeCleaningDisplay";
import { getDetailsStepIntro } from "./airbnbCleaningDisplay";

describe("officeCleaningDisplay", () => {
  it("exports slug guard", () => {
    expect(isOfficeCleaningSlug("office-cleaning")).toBe(true);
    expect(isOfficeCleaningSlug("moving-cleaning")).toBe(false);
  });

  it("provides commercial step 1 descriptions", () => {
    expect(OFFICE_SERVICE_STEP_DESCRIPTION_MOBILE).toContain("workspace");
    expect(OFFICE_SERVICE_STEP_DESCRIPTION_DESKTOP).toMatch(/productive|office/i);
  });

  it("routes details intro through airbnbCleaningDisplay", () => {
    const intro = getDetailsStepIntro("office-cleaning");
    expect(intro.title).toBe("Workspace details");
  });

  it("provides review and checkout bundles", () => {
    const review = getOfficeCleaningReviewCopy("office-cleaning");
    expect(review?.propertySectionTitle).toBe("Workspace details");
    expect(review?.addonsSectionLabel).toBe("Commercial cleaning extras");

    const checkout = getOfficeCleaningCheckoutCopy("office-cleaning");
    expect(checkout?.whatHappensNext[0]).toBe("Office cleaning scheduled");
  });

  it("uses commercial frequency labels", () => {
    const options = getOfficeFrequencyStepOptions("office-cleaning");
    expect(options?.find((o) => o.value === "once")?.label).toBe("One-time office clean");
  });

  it("returns null for non-office slugs", () => {
    expect(getOfficeCleaningStepCopy("deep-cleaning")).toBeNull();
  });
});
