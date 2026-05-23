import { describe, expect, it } from "vitest";
import { buildAdminDraftPricingInput } from "./adminPricingInput";
import { EMPTY_ADMIN_BOOKING_WIZARD_FORM } from "./draftFormState";

describe("buildAdminDraftPricingInput cadence gating", () => {
  it("forces once-off pricing for deep cleaning even when form has weekly frequency", () => {
    const input = buildAdminDraftPricingInput({
      ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
      serviceSlug: "deep-cleaning",
      frequency: "weekly",
      recurringIntervalWeeks: 1,
    });

    expect(input?.frequency).toBe("once");
  });
});
