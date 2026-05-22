import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAPE_TOWN_AREAS, SERVICE_SEO_PATHS } from "./constants";
import { LOCATION_SEO_SLUGS } from "./marketing-routes";
import { SERVICE_SEO_SLUGS, serviceSlugFromSeoSlug } from "./seo-pages";
import { buildMarketingSitemap, SITEMAP_ENTRY_COUNT } from "./sitemap";
import {
  assertAllAreasReceiveServiceInboundLinks,
  assertServiceCrossLinkPathsCanonical,
  getServiceLocationCrossLinks,
  getServicePageInboundAreaCoverage,
  SERVICE_LOCATION_CROSS_LINKS,
} from "./serviceLocationCrossLinks";
import { getLocationAuthority } from "./locationAuthorityContent";

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("serviceLocationCrossLinks", () => {
  it("defines cross-link config for all six service slugs", () => {
    expect(Object.keys(SERVICE_LOCATION_CROSS_LINKS)).toHaveLength(6);
    for (const slug of Object.keys(SERVICE_SEO_PATHS)) {
      const config = getServiceLocationCrossLinks(slug as keyof typeof SERVICE_SEO_PATHS);
      expect(config.featuredAreas.length).toBeGreaterThanOrEqual(6);
      expect(config.featuredAreas.length).toBeLessThanOrEqual(8);
      expect(config.introCopy.length).toBeGreaterThan(40);
    }
  });

  it("all 12 suburbs receive inbound links from at least one service page", () => {
    expect(() => assertAllAreasReceiveServiceInboundLinks()).not.toThrow();
    const coverage = getServicePageInboundAreaCoverage();
    for (const area of CAPE_TOWN_AREAS) {
      expect(coverage.get(area)!.length).toBeGreaterThan(0);
    }
  });

  it("uses canonical location paths only", () => {
    expect(() => assertServiceCrossLinkPathsCanonical()).not.toThrow();
    for (const seoSlug of SERVICE_SEO_SLUGS) {
      const { links } = getServiceLocationCrossLinks(serviceSlugFromSeoSlug(seoSlug));
      expect(links.length).toBeGreaterThan(0);
    }
  });

  it("anchor text is descriptive per service and suburb", () => {
    const { links } = getServiceLocationCrossLinks("airbnb-cleaning");
    const seaPoint = links.find((l) => l.area === "Sea Point");
    expect(seaPoint?.anchorText).toBe("Airbnb cleaning in Sea Point");
    expect(seaPoint?.href).toBe("/locations/sea-point-cape-town");
  });

  it("never uses legacy short location slugs in hrefs", () => {
    for (const serviceSlug of Object.keys(SERVICE_LOCATION_CROSS_LINKS) as Array<
      keyof typeof SERVICE_LOCATION_CROSS_LINKS
    >) {
      const { links } = getServiceLocationCrossLinks(serviceSlug);
      for (const link of links) {
        expect(link.href).toMatch(/\/locations\/[a-z0-9-]+-cape-town$/);
        expect(link.href).not.toMatch(/\/locations\/[a-z0-9-]+-cape-town-cape-town/);
      }
    }
  });
});

describe("serviceLocationCrossLinks UI wiring", () => {
  it("all six service pages include location areas section", () => {
    const source = readSource("src/app/(marketing)/services/[slug]/page.tsx");
    expect(source).toContain("ServiceLocationAreasSection");
    expect(source).toContain("showLocations");
  });

  it("services hub explore by area uses regional grouping", () => {
    const source = readSource("src/components/marketing/services-hub/ServicesHubSections.tsx");
    expect(source).toContain("ServicesHubExploreByAreaSection");
    expect(source).toContain("Explore by area");
  });

  it("pricing hub includes suburb chips", () => {
    const source = readSource("src/app/(marketing)/cleaning-prices-cape-town/page.tsx");
    expect(source).toContain("PricingHubAreaLinksSection");
  });

  it("no links to legacy /service path in cross-link modules", () => {
    const crossLinks = readSource("src/features/marketing/serviceLocationCrossLinks.ts");
    expect(crossLinks).not.toMatch(/["']\/service["']/);
    const servicePage = readSource("src/app/(marketing)/services/[slug]/page.tsx");
    expect(servicePage).not.toContain('href="/service"');
  });

  it("location popular services use service+suburb anchors", () => {
    for (const slug of LOCATION_SEO_SLUGS) {
      const authority = getLocationAuthority(slug);
      for (const service of authority.popularServices) {
        expect(service.linkLabel).toMatch(/ in /);
        expect(service.href.startsWith("/services/")).toBe(true);
      }
    }
  });

  it("sitemap entry count unchanged", () => {
    expect(buildMarketingSitemap()).toHaveLength(SITEMAP_ENTRY_COUNT);
  });
});
