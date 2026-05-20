import { describe, expect, it } from "vitest";
import {
  AIRBNB_CLEANING_SLUG,
  AIRBNB_FREQUENCY_STEP_OPTIONS,
  AIRBNB_SERVICE_STEP_DESCRIPTION_DESKTOP,
  AIRBNB_SERVICE_STEP_DESCRIPTION_MOBILE,
  buildAirbnbReviewHeroSegments,
  getAccessNotesFieldCopy,
  getFrequencyLabel,
  getFrequencyStepOptions,
  getScheduleStepHelperCopy,
  isAirbnbCleaningSlug,
} from "./airbnbCleaningDisplay";
import { WIZARD_SERVICE_OPTIONS } from "./constants";

describe("airbnbCleaningDisplay", () => {
  it("identifies canonical slug", () => {
    expect(isAirbnbCleaningSlug(AIRBNB_CLEANING_SLUG)).toBe(true);
    expect(isAirbnbCleaningSlug("regular-cleaning")).toBe(false);
  });

  it("uses host-oriented service card copy in wizard options", () => {
    const option = WIZARD_SERVICE_OPTIONS.find((s) => s.slug === AIRBNB_CLEANING_SLUG);
    expect(option?.description).toBe(AIRBNB_SERVICE_STEP_DESCRIPTION_MOBILE);
    expect(AIRBNB_SERVICE_STEP_DESCRIPTION_DESKTOP).toContain("guest");
  });

  it("provides turnover frequency labels without changing values", () => {
    expect(getFrequencyStepOptions(AIRBNB_CLEANING_SLUG)).toEqual(AIRBNB_FREQUENCY_STEP_OPTIONS);
    expect(getFrequencyLabel("once", AIRBNB_CLEANING_SLUG)).toBe("Single turnover");
    expect(getFrequencyLabel("weekly", AIRBNB_CLEANING_SLUG)).toBe("Weekly");
    expect(AIRBNB_FREQUENCY_STEP_OPTIONS.map((o) => o.value)).toEqual([
      "once",
      "weekly",
      "biweekly",
      "monthly",
    ]);
  });

  it("orders compact review hero for operational scanning without add-ons or frequency", () => {
    const segments = buildAirbnbReviewHeroSegments({
      scheduleLabel: "Mon 15 Jun · 09:00",
      locationLabel: "Sea Point, Cape Town",
      bedBathSummary: "2 beds · 1 bath",
      addonSummary: "Balcony reset",
      frequencyLabel: "Single turnover",
    });
    expect(segments).toEqual([
      "Mon 15 Jun · 09:00",
      "Sea Point, Cape Town",
      "2 beds · 1 bath",
    ]);
  });

  it("uses host access field copy", () => {
    const copy = getAccessNotesFieldCopy(AIRBNB_CLEANING_SLUG);
    expect(copy.label).toContain("access");
    expect(copy.placeholder.toLowerCase()).toContain("lockbox");
  });

  it("uses turnover schedule helper copy", () => {
    expect(getScheduleStepHelperCopy(AIRBNB_CLEANING_SLUG, false)).toContain("turnover");
    expect(getScheduleStepHelperCopy(AIRBNB_CLEANING_SLUG, false).toLowerCase()).toContain(
      "check-in",
    );
  });
});
