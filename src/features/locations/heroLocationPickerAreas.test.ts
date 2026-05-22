import { describe, expect, it } from "vitest";
import {
  filterHeroLocationPickerAreas,
  getHeroLocationPickerDisplayLabel,
  HERO_LOCATION_PICKER_AREAS,
} from "./heroLocationPickerAreas";

describe("heroLocationPickerAreas", () => {
  it("lists the required common service areas", () => {
    expect(HERO_LOCATION_PICKER_AREAS).toContain("Claremont");
    expect(HERO_LOCATION_PICKER_AREAS).toContain("Wynberg");
    expect(HERO_LOCATION_PICKER_AREAS).toContain("Somerset West");
    expect(HERO_LOCATION_PICKER_AREAS).toHaveLength(15);
  });

  it("formats picker labels as Area, Cape Town", () => {
    expect(getHeroLocationPickerDisplayLabel("Wynberg")).toBe("Wynberg, Cape Town");
  });

  it("filters suburbs by search query", () => {
    expect(filterHeroLocationPickerAreas("wyn")).toEqual(["Wynberg"]);
    expect(filterHeroLocationPickerAreas("")).toHaveLength(15);
  });
});
