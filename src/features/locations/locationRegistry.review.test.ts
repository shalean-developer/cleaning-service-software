import { describe, expect, it } from "vitest";
import { buildMarketingSitemap, SITEMAP_ENTRY_COUNT } from "@/features/marketing/sitemap";
import { getSeoLocations } from "./locationRegistry";
import {
  LOCATION_REVIEW_OVERRIDES,
  REVIEWED_LOCATION_SLUGS,
} from "./locationReviewOverrides";
import {
  findLocationByNameOrAlias,
  getOperationalServiceAreas,
  getRegistryAuditSummary,
  LOCATION_REGISTRY,
  resolveAreaSlug,
} from "./locationRegistry";

/** After review: duplicate Brooklyn Chestnut label removed. */
export const EXPECTED_OPERATIONAL_AREA_COUNT = 146;

describe("location registry review phase", () => {
  it("cleared all 28 reviewed slug overrides (29th was duplicate label removed)", () => {
    expect(REVIEWED_LOCATION_SLUGS).toHaveLength(28);
    for (const slug of REVIEWED_LOCATION_SLUGS) {
      const entry = LOCATION_REGISTRY.find((e) => e.slug === slug);
      expect(entry, `missing reviewed slug ${slug}`).toBeDefined();
      expect(entry?.requiresReview).toBeFalsy();
      expect(LOCATION_REVIEW_OVERRIDES[slug]?.requiresReview).toBe(false);
    }
  });

  it("has zero requiresReview entries after review pass", () => {
    const pending = LOCATION_REGISTRY.filter((e) => e.requiresReview);
    expect(pending).toEqual([]);
    expect(getRegistryAuditSummary().requiresReview).toBe(0);
  });

  it("resolves reviewed aliases including merged Brooklyn Chestnut", () => {
    expect(resolveAreaSlug("Brooklyn Chestnut")).toBe("brooklyn");
    expect(findLocationByNameOrAlias("Mouille Point")?.slug).toBe("mouille-point");
    expect(findLocationByNameOrAlias("Pinelands")?.isSeoLocation).toBe(false);
    expect(findLocationByNameOrAlias("Tableview")?.slug).toBe("table-view");
  });

  it("keeps broad region labels operational-only without SEO paths", () => {
    for (const name of ["Northern Suburbs", "Southern Suburbs", "Cape Flats", "Helderberg"]) {
      const entry = findLocationByNameOrAlias(name);
      expect(entry?.serviceAreaType).toBe("cape_town_area");
      expect(entry?.isSeoLocation).toBe(false);
      expect(entry?.seoSlug).toBeUndefined();
      expect(entry?.requiresReview).toBeFalsy();
    }
  });

  it("classifies Plettenberg Bay as Garden Route operational town", () => {
    const entry = findLocationByNameOrAlias("Plettenberg Bay");
    expect(entry?.serviceAreaType).toBe("garden_route");
    expect(entry?.cityGroup).toBe("Garden Route");
    expect(entry?.isSeoLocation).toBe(false);
  });

  it("maintains stable operational count and 12 SEO pages", () => {
    expect(getOperationalServiceAreas()).toHaveLength(EXPECTED_OPERATIONAL_AREA_COUNT);
    expect(getSeoLocations()).toHaveLength(12);
    expect(buildMarketingSitemap()).toHaveLength(SITEMAP_ENTRY_COUNT);
    const suburbPages = buildMarketingSitemap().filter((e) =>
      /\/locations\/[^/]+$/.test(e.url),
    );
    expect(suburbPages).toHaveLength(12);
    for (const entry of LOCATION_REGISTRY) {
      if (!entry.isSeoLocation) {
        expect(entry.canonicalPath).toBeUndefined();
      }
    }
  });
});
