import { describe, expect, it } from "vitest";
import {
  HERO_QUOTE_OTHER_LOCATION_LABEL,
  buildHeroQuoteLocationOptions,
  filterHeroQuoteLocationOptions,
} from "./heroQuoteLocationOptions";

describe("heroQuoteLocationOptions", () => {
  const options = buildHeroQuoteLocationOptions();

  it("includes all quote suburbs plus Other Cape Town area", () => {
    expect(options.some((o) => o.label === "Wynberg, Cape Town")).toBe(true);
    expect(options.some((o) => o.label === "Camps Bay, Cape Town")).toBe(true);
    expect(options.some((o) => o.value === HERO_QUOTE_OTHER_LOCATION_LABEL)).toBe(true);
    expect(options).toHaveLength(17);
  });

  it("filters by suburb name case-insensitively", () => {
    const filtered = filterHeroQuoteLocationOptions(options, "wyn");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.label).toBe("Wynberg, Cape Town");
  });

  it("filters by city name", () => {
    const filtered = filterHeroQuoteLocationOptions(options, "cape town");
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((o) => o.label.toLowerCase().includes("cape town"))).toBe(true);
  });
});
