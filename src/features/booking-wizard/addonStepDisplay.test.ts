import { describe, expect, it } from "vitest";
import { DEEP_ADDON_STEP_DISPLAY_ORDER } from "./deepCleaningDisplay";
import { getAddonStepDisplayOrder, getAddonStepDescription, getAddonStepLabel } from "./addonStepDisplay";

describe("addonStepDisplay", () => {
  it("returns regular-cleaning add-ons without balcony in product order", () => {
    const order = getAddonStepDisplayOrder("regular-cleaning");

    expect(order).toEqual([
      "inside-cabinets",
      "inside-oven",
      "inside-fridge",
      "interior-walls",
      "laundry",
      "interior-windows",
    ]);
    expect(order).not.toContain("balcony");
  });

  it("returns deep/move add-on order for deep cleaning", () => {
    const order = getAddonStepDisplayOrder("deep-cleaning");

    expect(order).toEqual(DEEP_ADDON_STEP_DISPLAY_ORDER);
    expect(order).toContain("couch-cleaning");
    expect(order).not.toContain("inside-cabinets");
    expect(getAddonStepDescription("balcony", "deep-cleaning")).toMatch(/balcony|outdoor/i);
  });

  it("uses regular-cleaning display label for laundry", () => {
    expect(getAddonStepLabel("laundry", "regular-cleaning")).toBe("Ironing & Laundry");
    expect(getAddonStepLabel("laundry", "deep-cleaning")).toBe("Laundry");
  });
});
