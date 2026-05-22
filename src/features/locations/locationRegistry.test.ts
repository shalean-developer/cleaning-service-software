import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCATION_SEO_SLUG_LIST } from "@/features/marketing/locationSlugList";
import { buildMarketingSitemap, SITEMAP_ENTRY_COUNT } from "@/features/marketing/sitemap";
import { LOCATION_SEO_SLUGS } from "@/features/marketing/marketing-routes";
import { CAPE_TOWN_AREAS } from "@/features/marketing/constants";
import {
  findLocationByNameOrAlias,
  getOperationalServiceAreas,
  getSeoLocations,
  LOCATION_REGISTRY,
  normalizeLocationName,
  resolveAreaSlug,
  SEO_LOCATION_NAMES,
  SEO_LOCATION_SLUG_LIST,
} from "./locationRegistry";

describe("locationRegistry normalization", () => {
  it("strips House Cleaning prefix and fixes known variants", () => {
    expect(normalizeLocationName("House Cleaning Tableview")).toBe("Table View");
    expect(normalizeLocationName("House Cleaning Oudshoorn")).toBe("Oudtshoorn");
    expect(normalizeLocationName("House Cleaning Cape gate")).toBe("Cape Gate");
    expect(normalizeLocationName("House Cleaning D'urbanvale")).toBe("Durbanville");
  });

  it("deduplicates Table View variants to one registry entry", () => {
    const tableViewEntries = LOCATION_REGISTRY.filter((e) => e.name === "Table View");
    expect(tableViewEntries).toHaveLength(1);
    expect(tableViewEntries[0]?.isSeoLocation).toBe(true);
  });

  it("matches aliases and display names to registry slugs", () => {
    expect(resolveAreaSlug("Sea Point")).toBe("sea-point");
    expect(resolveAreaSlug("Tableview")).toBe("table-view");
    expect(findLocationByNameOrAlias("D'Urbanvale")?.name).toBe("Durbanville");
  });

  it("flags broad geographic labels for review", () => {
    const review = LOCATION_REGISTRY.filter((e) => e.requiresReview);
    const names = review.map((e) => e.name);
    expect(names).toContain("Northern Suburbs");
    expect(names).toContain("Southern Suburbs");
    expect(names).toContain("Cape Flats");
  });
});

describe("locationRegistry SEO safety", () => {
  it("keeps exactly 12 SEO locations aligned with marketing constants", () => {
    expect(getSeoLocations()).toHaveLength(12);
    expect([...SEO_LOCATION_NAMES]).toEqual([...CAPE_TOWN_AREAS]);
    expect([...SEO_LOCATION_SLUG_LIST]).toEqual([...LOCATION_SEO_SLUG_LIST]);
    expect([...LOCATION_SEO_SLUGS]).toEqual([...LOCATION_SEO_SLUG_LIST]);
  });

  it("operational-only areas have no SEO paths", () => {
    const operationalOnly = LOCATION_REGISTRY.filter(
      (e) => e.isOperationalArea && !e.isSeoLocation,
    );
    expect(operationalOnly.length).toBeGreaterThan(50);
    for (const entry of operationalOnly) {
      expect(entry.seoSlug).toBeUndefined();
      expect(entry.canonicalPath).toBeUndefined();
    }
  });

  it("does not expand sitemap location entries", () => {
    const sitemap = buildMarketingSitemap();
    const suburbPages = sitemap.filter((e) => /\/locations\/[^/]+$/.test(e.url));
    expect(suburbPages).toHaveLength(12);
    expect(sitemap.some((e) => e.url.endsWith("/locations"))).toBe(true);
    expect(buildMarketingSitemap()).toHaveLength(SITEMAP_ENTRY_COUNT);
  });

  it("static params source remains 12 SEO slugs only", () => {
    const pageSource = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/locations/[slug]/page.tsx"),
      "utf8",
    );
    expect(pageSource).toContain("LOCATION_SEO_SLUGS.map");
    expect(pageSource).not.toContain("LOCATION_REGISTRY");
    expect(pageSource).not.toContain("getOperationalServiceAreas");
  });
});

describe("locationRegistry operational coverage", () => {
  it("imports 100+ operational areas from House Cleaning labels", () => {
    expect(getOperationalServiceAreas().length).toBeGreaterThanOrEqual(100);
  });

  it("exposes booking and cleaner area options", () => {
    const operational = getOperationalServiceAreas();
    expect(operational.length).toBeGreaterThan(0);
    for (const entry of operational) {
      expect(entry.slug).toMatch(/^[a-z0-9-]+$/);
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });
});
