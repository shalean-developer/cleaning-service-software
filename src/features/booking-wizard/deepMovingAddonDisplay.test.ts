import { describe, expect, it } from "vitest";
import { getAddonStepDisplayOrder, getAddonStepLabel } from "./addonStepDisplay";
import {
  DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER,
  DEEP_MOVING_ADDON_STEP_LABELS,
} from "./deepMovingAddonDisplay";

describe("deepMovingAddonDisplay", () => {
  it("lists only deep/move add-ons in product order", () => {
    expect(DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER).toEqual([
      "balcony",
      "carpet-addon",
      "ceiling-cleaning",
      "garage-cleaning",
      "mattress-cleaning",
      "outside-windows",
      "couch-cleaning",
    ]);
    expect(DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER).not.toContain("inside-cabinets");
    expect(DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER).not.toContain("laundry");
  });

  it("uses Couch cleaning label (not Courch)", () => {
    expect(DEEP_MOVING_ADDON_STEP_LABELS["couch-cleaning"]).toBe("Couch cleaning");
    expect(getAddonStepLabel("couch-cleaning", "deep-cleaning")).toBe("Couch cleaning");
    expect(getAddonStepLabel("couch-cleaning", "moving-cleaning")).toBe("Couch cleaning");
  });

  it("applies the same add-on list to deep and move services", () => {
    expect(getAddonStepDisplayOrder("deep-cleaning")).toEqual(
      DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER,
    );
    expect(getAddonStepDisplayOrder("moving-cleaning")).toEqual(
      DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER,
    );
  });

  it("does not expose deep/move add-ons on regular cleaning", () => {
    const regular = getAddonStepDisplayOrder("regular-cleaning");
    expect(regular).not.toContain("carpet-addon");
    expect(regular).not.toContain("couch-cleaning");
    expect(regular).not.toContain("outside-windows");
  });
});
