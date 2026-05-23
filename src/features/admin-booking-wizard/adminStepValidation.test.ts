import { describe, expect, it } from "vitest";
import { validateAdminWizardStep } from "./adminStepValidation";
import { EMPTY_ADMIN_BOOKING_WIZARD_FORM } from "./draftFormState";

describe("validateAdminWizardStep", () => {
  it("blocks schedule step with past date", () => {
    const result = validateAdminWizardStep("schedule", {
      ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
      date: "2020-01-01",
      time: "09:00",
    });
    expect(result.valid).toBe(false);
  });

  it("allows service step when slug selected", () => {
    const result = validateAdminWizardStep("service", {
      ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
      serviceSlug: "regular-cleaning",
    });
    expect(result.valid).toBe(true);
  });
});
