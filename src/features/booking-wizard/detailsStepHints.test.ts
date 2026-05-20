import { describe, expect, it } from "vitest";
import { equipmentSupplyVisibleHint, teamSupportVisibleHint } from "./detailsStepHints";

describe("detailsStepHints", () => {
  it("shows equipment supply state hints", () => {
    expect(equipmentSupplyVisibleHint("customer")).toContain("You provide");
    expect(equipmentSupplyVisibleHint("shalean")).toContain("+ R 100");
    expect(equipmentSupplyVisibleHint("shalean")).toContain("Shalean supplies");
  });

  it("shows team support request surcharge and confirmation wording", () => {
    expect(teamSupportVisibleHint(1)).toContain("single-cleaner");
    expect(teamSupportVisibleHint(2)).toContain("+ R 200");
    expect(teamSupportVisibleHint(2)).toContain("availability confirmed after payment");
  });
});
