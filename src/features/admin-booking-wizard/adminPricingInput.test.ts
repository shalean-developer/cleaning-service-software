import { describe, expect, it } from "vitest";
import { buildAdminDraftPricingInput } from "./adminPricingInput";
import { EMPTY_ADMIN_BOOKING_WIZARD_FORM } from "./draftFormState";

describe("buildAdminDraftPricingInput", () => {
  it("includes extras and team support for regular cleaning", () => {
    const input = buildAdminDraftPricingInput({
      ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
      serviceSlug: "regular-cleaning",
      bedrooms: 3,
      bathrooms: 2,
      extraRooms: 1,
      cleaningIntensity: "deep",
      equipmentSupply: "company",
      requestedTeamSize: 2,
      addons: ["inside-fridge"],
      frequency: "weekly",
    });

    expect(input).toMatchObject({
      serviceSlug: "regular-cleaning",
      extraRooms: 1,
      cleaningIntensity: "deep",
      equipmentSupply: "company",
      requestedTeamSize: 2,
      addons: ["inside-fridge"],
      frequency: "weekly",
    });
  });

  it("derives office property size from tiers", () => {
    const input = buildAdminDraftPricingInput({
      ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
      serviceSlug: "office-cleaning",
      officeSizeTier: "medium",
      officeWorkstations: "10",
    });

    expect(input?.serviceSlug).toBe("office-cleaning");
    expect(input?.propertySizeSqm).toBeGreaterThan(0);
  });

  it("returns null without a service slug", () => {
    expect(buildAdminDraftPricingInput(EMPTY_ADMIN_BOOKING_WIZARD_FORM)).toBeNull();
  });

  it("maps custom weekly cadence to weekly pricing frequency", () => {
    const input = buildAdminDraftPricingInput({
      ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
      serviceSlug: "regular-cleaning",
      frequency: "custom",
      recurringIntervalWeeks: 2,
      recurringDays: [5],
    });

    expect(input?.frequency).toBe("biweekly");
  });
});
