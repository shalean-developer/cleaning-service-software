import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildFaqPageSchema } from "./seo";
import { LOCATION_SEO_SLUGS } from "./marketing-routes";
import {
  assertLocationRegionsComplete,
  getLocationAuthority,
  LOCATION_AUTHORITY_BY_SLUG,
  LOCATION_REGIONS,
  PRICING_GUIDANCE_PATH,
} from "./locationAuthorityContent";
import { getNearbyLocationLinks } from "./locationNearbyAreas";
import { SITEMAP_ENTRY_COUNT, buildMarketingSitemap } from "./sitemap";

describe("locationAuthorityContent", () => {
  it("covers all suburbs with authority content and FAQs", () => {
    expect(() => assertLocationRegionsComplete()).not.toThrow();
    for (const slug of LOCATION_SEO_SLUGS) {
      const authority = getLocationAuthority(slug);
      expect(authority.faqs.length).toBeGreaterThanOrEqual(3);
      expect(authority.popularServices.length).toBeGreaterThanOrEqual(3);
      expect(authority.localOverview.length).toBeGreaterThan(80);
    }
  });

  it("regions include every suburb exactly once", () => {
    const areas = LOCATION_REGIONS.flatMap((r) => r.areas);
    expect(areas).toHaveLength(12);
    expect(new Set(areas).size).toBe(12);
  });

  it("FAQ schema matches visible FAQ copy", () => {
    const slug = "sea-point-cape-town";
    const authority = LOCATION_AUTHORITY_BY_SLUG[slug];
    const schema = buildFaqPageSchema(authority.faqs);
    const firstQuestion = schema.mainEntity[0]?.name;
    expect(firstQuestion).toBe(authority.faqs[0]?.question);
    expect(firstQuestion).toContain("Sea Point");
  });

  it("popular service links use valid service paths", () => {
    for (const slug of LOCATION_SEO_SLUGS) {
      const authority = getLocationAuthority(slug);
      for (const service of authority.popularServices) {
        expect(service.href).toMatch(/^\/services\//);
        expect(service.linkLabel).toContain("in ");
      }
    }
  });

  it("pricing guidance path points to pricing hub", () => {
    expect(PRICING_GUIDANCE_PATH).toBe("/cleaning-prices-cape-town");
  });

  it("nearby areas remain valid after authority expansion", () => {
    const nearby = getNearbyLocationLinks("claremont-cape-town");
    expect(nearby.length).toBeGreaterThan(0);
    expect(nearby.every((n) => n.path.endsWith("-cape-town"))).toBe(true);
  });

  it("sitemap entry count unchanged", () => {
    expect(buildMarketingSitemap()).toHaveLength(SITEMAP_ENTRY_COUNT);
  });
});

describe("location phase 2 UI", () => {
  it("suburb page renders authority sections and FAQ schema", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/locations/[slug]/page.tsx"),
      "utf8",
    );
    expect(source).toContain("LocationSuburbAuthoritySections");
    expect(source).toContain("buildFaqPageSchema");
  });

  it("hub page has regional grouping", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/locations/page.tsx"),
      "utf8",
    );
    expect(source).toContain("LocationsHubRegionsSection");
    expect(LOCATION_REGIONS.some((r) => r.title === "Atlantic Seaboard")).toBe(true);
    expect(LOCATION_REGIONS.some((r) => r.title === "Southern Suburbs")).toBe(true);
  });

  it("pricing hub links to locations", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/cleaning-prices-cape-town/page.tsx"),
      "utf8",
    );
    expect(source).toContain("LOCATIONS_HUB_PATH");
  });

  it("services hub lists all suburb areas", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/marketing/services-hub-content.ts"),
      "utf8",
    );
    expect(source).toContain("SERVICES_HUB_FEATURED_AREAS = CAPE_TOWN_AREAS");
  });
});
