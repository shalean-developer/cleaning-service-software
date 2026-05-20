import { describe, expect, it } from "vitest";
import {
  buildOfficeReviewHeroSegments,
  getOfficeCleaningCheckoutCopy,
  getOfficeCleaningReviewCopy,
  getOfficeCleaningStepCopy,
  getOfficeFrequencyStepOptions,
  isOfficeCleaningSlug,
  showWizardContextStripForService,
  OFFICE_ADDON_STEP_DISPLAY_ORDER,
  OFFICE_ADDON_STEP_GROUPS,
  OFFICE_ADDON_STEP_DESCRIPTIONS,
  OFFICE_SERVICE_STEP_DESCRIPTION_DESKTOP,
  OFFICE_SERVICE_STEP_DESCRIPTION_MOBILE,
} from "./officeCleaningDisplay";
import { getDetailsStepIntro } from "./airbnbCleaningDisplay";

describe("officeCleaningDisplay", () => {
  it("exports slug guard", () => {
    expect(isOfficeCleaningSlug("office-cleaning")).toBe(true);
    expect(isOfficeCleaningSlug("moving-cleaning")).toBe(false);
  });

  it("hides the compact wizard context strip for office cleaning", () => {
    expect(showWizardContextStripForService("office-cleaning")).toBe(false);
    expect(showWizardContextStripForService("regular-cleaning")).toBe(true);
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

  it("builds compact office review hero without add-ons, frequency, or duplicate location", () => {
    const segments = buildOfficeReviewHeroSegments({
      scheduleLabel: "Wed, 20 May 2026, 14:00",
      locationLabel: "Kenilworth",
      officeSizeLabel: "Large office",
      workstationLabel: "5 workstations",
    });
    expect(segments).toEqual([
      "Wed, 20 May 2026, 14:00",
      "Kenilworth",
      "Large office",
      "5 workstations",
    ]);
    expect(segments.join(" · ")).not.toMatch(/One-time office clean/);
    expect(segments.join(" · ")).not.toMatch(/Window cleaning/);
  });

  it("uses commercial frequency labels", () => {
    const options = getOfficeFrequencyStepOptions("office-cleaning");
    expect(options?.find((o) => o.value === "once")?.label).toBe("One-time office clean");
  });

  it("returns null for non-office slugs", () => {
    expect(getOfficeCleaningStepCopy("deep-cleaning")).toBeNull();
  });

  it("uses extras title and operational addon groups", () => {
    const step = getOfficeCleaningStepCopy("office-cleaning");
    expect(step?.addonsTitle).toBe("Extras");
    expect(step?.homeSizeTitle).toBe("Office size");
    expect(OFFICE_ADDON_STEP_GROUPS.map((g) => g.title)).toEqual([
      "Workspace care",
      "Kitchen & hygiene",
      "Scheduling",
    ]);
    expect(OFFICE_ADDON_STEP_DISPLAY_ORDER).toEqual(
      OFFICE_ADDON_STEP_GROUPS.flatMap((g) => g.slugs),
    );
    expect(OFFICE_ADDON_STEP_DESCRIPTIONS["boardroom-detailing"]).toBe(
      "Conference room surfaces and presentation areas.",
    );
    expect(OFFICE_ADDON_STEP_DESCRIPTIONS["after-hours-cleaning"]).toBe(
      "Cleaning scheduled outside office operating hours.",
    );
  });
});
