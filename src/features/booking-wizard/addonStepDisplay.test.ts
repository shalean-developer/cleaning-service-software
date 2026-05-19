import { describe, expect, it } from "vitest";
import { getAddonStepDisplayOrder, getAddonStepLabel } from "./addonStepDisplay";

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

  it("returns default add-on order for other services", () => {
    const order = getAddonStepDisplayOrder("deep-cleaning");

    expect(order).toContain("balcony");
    expect(order).toContain("inside-cabinets");
    expect(order).toContain("interior-walls");
  });

  it("uses regular-cleaning display label for laundry", () => {
    expect(getAddonStepLabel("laundry", "regular-cleaning")).toBe("Ironing & Laundry");
    expect(getAddonStepLabel("laundry", "deep-cleaning")).toBe("Laundry");
  });
});
