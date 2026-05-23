import { describe, expect, it } from "vitest";
import { applyAdminServiceSelection } from "./adminServiceSelection";
import { EMPTY_ADMIN_BOOKING_WIZARD_FORM } from "./draftFormState";

describe("applyAdminServiceSelection", () => {
  it("resets invalid addons when service changes", () => {
    const withAddons = {
      ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
      serviceSlug: "regular-cleaning" as const,
      addons: ["oven-cleaning"] as const,
      requestedTeamSize: 2 as const,
    };

    const carpet = applyAdminServiceSelection(withAddons, "carpet-cleaning");
    expect(carpet.serviceSlug).toBe("carpet-cleaning");
    expect(carpet.addons).toEqual([]);
    expect(carpet.requestedTeamSize).toBe(1);
  });

  it("preserves allowed addons for the target service", () => {
    const state = {
      ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
      serviceSlug: "deep-cleaning" as const,
      addons: ["inside-fridge"] as const,
    };

    const regular = applyAdminServiceSelection(state, "regular-cleaning");
    expect(regular.addons).toContain("inside-fridge");
  });

  it("clears cadence when switching to a non-recurring service", () => {
    const state = {
      ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
      serviceSlug: "regular-cleaning" as const,
      frequency: "weekly" as const,
      recurringDays: [1, 4],
      recurringIntervalWeeks: 2,
    };

    const deep = applyAdminServiceSelection(state, "deep-cleaning");
    expect(deep.frequency).toBe("once");
    expect(deep.recurringDays).toEqual([]);
    expect(deep.recurringIntervalWeeks).toBe(1);
  });
});
