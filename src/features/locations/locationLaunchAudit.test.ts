/**
 * Location launch readiness audit (run via npm run ops:audit:location-launch).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCATION_SEO_SLUG_LIST } from "@/features/marketing/locationSlugList";
import { legacyLocationPathFromSlug, buildLocationLegacyRedirects } from "@/features/marketing/locationRedirects";
import { APPLY_FORM_PAGE_PATH } from "@/features/marketing/marketing-routes";
import { buildMarketingSitemap, SITEMAP_ENTRY_COUNT } from "@/features/marketing/sitemap";
import { DEFAULT_MARKETING_SITE_URL } from "@/features/marketing/siteUrl";
import {
  INVALID_LOCATION_SLUG_SAMPLE,
  OPERATIONAL_ONLY_SLUG_SAMPLE,
  getLaunchCrawlPaths,
  printLaunchAuditReport,
  runStaticLaunchAudit,
  validateRedirectConfig,
  validateSitemapLaunch,
} from "./locationLaunchAudit";

describe("location launch audit static checks", () => {
  it("prints launch report and passes all static checks", () => {
    const result = runStaticLaunchAudit();
    printLaunchAuditReport(result);
    expect(result.issues).toEqual([]);
  });

  it("defines crawl paths for hub, suburbs, legacy, services, and pricing", () => {
    const paths = getLaunchCrawlPaths();
    expect(paths).toContain("/locations");
    const canonicalSuburbs = paths.filter(
      (p) =>
        p.startsWith("/locations/") &&
        p.endsWith("-cape-town") &&
        p !== `/locations/${INVALID_LOCATION_SLUG_SAMPLE}` &&
        p !== `/locations/${OPERATIONAL_ONLY_SLUG_SAMPLE}`,
    );
    expect(canonicalSuburbs).toHaveLength(12);
    expect(paths.filter((p) => p.startsWith("/locations/") && !p.endsWith("-cape-town"))).toHaveLength(12);
    expect(paths).toContain(`/locations/${INVALID_LOCATION_SLUG_SAMPLE}`);
    expect(paths).toContain(`/locations/${OPERATIONAL_ONLY_SLUG_SAMPLE}`);
    expect(paths).toContain("/services");
    expect(paths).toContain("/cleaning-prices-cape-town");
    expect(paths.filter((p) => p.startsWith("/services/"))).toHaveLength(6);
  });

  it("keeps sitemap controlled at 12 suburb pages", () => {
    const issues = validateSitemapLaunch();
    expect(issues).toEqual([]);
    const urls = buildMarketingSitemap().map((e) => e.url);
    expect(urls).toHaveLength(SITEMAP_ENTRY_COUNT);
    expect(urls.filter((u) => /\/locations\/[^/]+$/.test(u))).toHaveLength(12);
    expect(urls.some((u) => u.endsWith(APPLY_FORM_PAGE_PATH))).toBe(false);
    expect(urls.every((u) => u.startsWith(DEFAULT_MARKETING_SITE_URL))).toBe(true);
  });

  it("configures 12 legacy short slug redirects to canonical", () => {
    const issues = validateRedirectConfig();
    expect(issues).toEqual([]);
    const redirects = buildLocationLegacyRedirects();
    expect(redirects).toHaveLength(12);
    for (const slug of LOCATION_SEO_SLUG_LIST) {
      const legacy = legacyLocationPathFromSlug(slug);
      const rule = redirects.find((r) => r.source === legacy);
      expect(rule?.destination).toBe(`/locations/${slug}`);
      expect(rule?.permanent).toBe(true);
    }
  });

  it("suburb page generateStaticParams uses SEO slugs only", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/locations/[slug]/page.tsx"),
      "utf8",
    );
    expect(source).toContain("LOCATION_SEO_SLUGS.map");
    expect(source).not.toContain("getOperationalServiceAreas");
    expect(source).not.toContain("LOCATION_REGISTRY");
  });

  it("robots allows /locations", () => {
    const source = readFileSync(path.join(process.cwd(), "src/app/robots.ts"), "utf8");
    expect(source).not.toMatch(/disallow:\s*["']\/locations/);
  });
});
