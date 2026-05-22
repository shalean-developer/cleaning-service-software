import { describe, expect, it } from "vitest";
import {
  INITIAL_CLEANER_APPLY_FORM,
  validateCleanerApplyStep,
  workPreferencesToServiceSlugs,
} from "./applyFormModel";

describe("applyFormModel", () => {
  it("maps work preferences to service slugs for provisioning", () => {
    const slugs = workPreferencesToServiceSlugs([
      "regular_home_cleaning",
      "airbnb_turnovers",
      "recurring_schedules",
    ]);
    expect(slugs).toContain("regular-cleaning");
    expect(slugs).toContain("airbnb-cleaning");
    expect(slugs).not.toContain("carpet-cleaning");
  });

  it("validates step 1 requires suburb", () => {
    const errors = validateCleanerApplyStep(0, {
      ...INITIAL_CLEANER_APPLY_FORM,
      fullName: "Test User",
      phone: "0821234567",
      suburb: "",
    });
    expect(errors.suburb).toBeDefined();
  });

  it("validates step 2 requires work preferences", () => {
    const errors = validateCleanerApplyStep(1, {
      ...INITIAL_CLEANER_APPLY_FORM,
      availabilityDays: [1],
      preferredAreas: ["Sea Point"],
      hasOwnTransport: true,
      workPreferences: [],
    });
    expect(errors.workPreferences).toBeDefined();
  });

  it("validates step 4 requires consent", () => {
    const errors = validateCleanerApplyStep(3, {
      ...INITIAL_CLEANER_APPLY_FORM,
      consent: false,
    });
    expect(errors.consent).toBeDefined();
  });
});
