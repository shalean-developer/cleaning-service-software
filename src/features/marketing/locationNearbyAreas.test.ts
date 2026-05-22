import { describe, expect, it } from "vitest";
import { LOCATION_SEO_SLUGS } from "./marketing-routes";
import { LOCATION_SEO_CONTENT } from "./seo-pages";
import {
  assertLocationNearbyMapComplete,
  getNearbyLocationLinks,
  LOCATION_NEARBY_BY_SLUG,
} from "./locationNearbyAreas";

describe("locationNearbyAreas", () => {
  it("has a complete nearby map for all canonical slugs", () => {
    expect(() => assertLocationNearbyMapComplete()).not.toThrow();
    expect(Object.keys(LOCATION_NEARBY_BY_SLUG)).toHaveLength(
      LOCATION_SEO_SLUGS.length,
    );
  });

  it("never self-links in nearby lists", () => {
    for (const slug of LOCATION_SEO_SLUGS) {
      const nearby = LOCATION_NEARBY_BY_SLUG[slug];
      expect(nearby).not.toContain(slug);
    }
  });

  it("returns only canonical paths and labels", () => {
    const links = getNearbyLocationLinks("sea-point-cape-town");
    expect(links.length).toBeGreaterThanOrEqual(3);
    expect(links.length).toBeLessThanOrEqual(5);
    for (const link of links) {
      expect(link.path).toMatch(/^\/locations\/[a-z-]+-cape-town$/);
      expect(link.label).toContain("Cleaning services in");
      expect(LOCATION_SEO_CONTENT[link.slug]).toBeDefined();
    }
  });
});
