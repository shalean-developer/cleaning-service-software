import { describe, expect, it } from "vitest";
import {
  formatLocationName,
  formatServiceAreaList,
  isKnownOperationalArea,
  locationSearchTokens,
  normalizeLocationInput,
  resolveOperationalLocation,
} from "./locationDisplay";
import {
  getCleanerAreaOptionGroups,
  getPopularOperationalAreas,
  getSeoLocations,
  OPERATIONAL_REGION_ORDER,
  resolveAreaSlug,
  sortCleanerAreaOptionGroups,
} from "./locationRegistry";
import {
  filterCleanerAreaOptionGroups,
  locationOptionMatchesQuery,
} from "./operationalLocationSearch";

describe("locationDisplay helpers", () => {
  it("formatLocationName resolves slugs and aliases", () => {
    expect(formatLocationName("sea-point")).toBe("Sea Point");
    expect(formatLocationName("Tableview")).toBe("Table View");
    expect(formatLocationName("unknown-place")).toBe("Unknown Place");
  });

  it("resolveOperationalLocation and isKnownOperationalArea", () => {
    expect(resolveOperationalLocation("Sea Point")?.slug).toBe("sea-point");
    expect(isKnownOperationalArea("D'Urbanvale")).toBe(true);
    expect(isKnownOperationalArea("Mars Colony")).toBe(false);
  });

  it("normalizeLocationInput returns canonical name when known", () => {
    expect(normalizeLocationInput("tableview")).toBe("Table View");
    expect(normalizeLocationInput("Custom Area")).toBe("Custom Area");
  });

  it("formatServiceAreaList shows human-readable names", () => {
    expect(formatServiceAreaList([])).toBe("All service areas");
    expect(formatServiceAreaList(["sea-point", "claremont"])).toBe("Sea Point, Claremont");
    expect(formatServiceAreaList(["a", "b", "c", "d"])).toContain("+1 more");
  });

  it("locationSearchTokens includes aliases for admin search", () => {
    const tokens = locationSearchTokens("Tableview");
    expect(tokens).toContain("table view");
    expect(tokens.some((t) => t.includes("table"))).toBe(true);
  });
});

describe("operational location search", () => {
  it("filters options by label, slug, and alias", () => {
    const groups = getCleanerAreaOptionGroups();
    const sea = groups
      .flatMap((g) => g.options)
      .find((o) => o.slug === "sea-point");
    expect(sea).toBeDefined();
    expect(locationOptionMatchesQuery(sea!, "Sea")).toBe(true);
    expect(locationOptionMatchesQuery(sea!, "tableview")).toBe(false);

    const tableFiltered = filterCleanerAreaOptionGroups(groups, "Tableview");
    const tableLabels = tableFiltered.flatMap((g) => g.options.map((o) => o.label));
    expect(tableLabels).toContain("Table View");

    const boKaapFiltered = filterCleanerAreaOptionGroups(groups, "Bo Kaap");
    const boKaapLabels = boKaapFiltered.flatMap((g) => g.options.map((o) => o.label));
    expect(boKaapLabels).toContain("De Waterkant");
  });

  it("booking alias resolves to expected slug", () => {
    expect(resolveAreaSlug("Tableview")).toBe("table-view");
    expect(resolveAreaSlug("Sea Point")).toBe("sea-point");
    expect(resolveAreaSlug("Bo Kaap")).toBe("de-waterkant");
  });
});

describe("region grouping UX", () => {
  it("sorts groups by OPERATIONAL_REGION_ORDER", () => {
    const groups = getCleanerAreaOptionGroups();
    const sorted = sortCleanerAreaOptionGroups([...groups].reverse());
    const firstRegion = sorted[0]?.region;
    expect(OPERATIONAL_REGION_ORDER).toContain(firstRegion);
  });

  it("exposes twelve popular featured areas", () => {
    expect(getPopularOperationalAreas()).toHaveLength(12);
    expect(getPopularOperationalAreas()[0]?.isSeoLocation).toBe(true);
    expect(getSeoLocations()).toHaveLength(12);
  });
});
