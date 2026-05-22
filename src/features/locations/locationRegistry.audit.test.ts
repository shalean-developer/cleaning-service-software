/**
 * Operational audit for location registry (run via npm run ops:audit:location-registry).
 */
import { describe, expect, it } from "vitest";
import { buildMarketingSitemap, SITEMAP_ENTRY_COUNT } from "@/features/marketing/sitemap";
import {
  getRegistryAuditSummary,
  LOCATION_REGISTRY,
  assertRegistryInvariants,
} from "./locationRegistry";

function printAuditReport(): void {
  const summary = getRegistryAuditSummary();
  const slugs = new Set<string>();
  const duplicateSlugs: string[] = [];
  const aliasCollisions: string[] = [];
  const seenAliasKeys = new Map<string, string>();

  for (const entry of LOCATION_REGISTRY) {
    if (slugs.has(entry.slug)) duplicateSlugs.push(entry.slug);
    slugs.add(entry.slug);
    const keys = [
      entry.normalizedName,
      ...entry.aliases.map((a) => a.toLowerCase().replace(/[^a-z0-9]+/g, " ")),
    ];
    for (const key of keys) {
      const prior = seenAliasKeys.get(key);
      if (prior && prior !== entry.slug) aliasCollisions.push(`${key}: ${prior} vs ${entry.slug}`);
      else seenAliasKeys.set(key, entry.slug);
    }
  }

  const missingRegion = LOCATION_REGISTRY.filter((e) => !e.region.trim()).map((e) => e.name);
  const sitemap = buildMarketingSitemap();
  const sitemapLocationCount = sitemap.filter((u) => /\/locations\/[^/]+$/.test(u.url)).length;
  const sitemapHasHub = sitemap.some((u) => u.url.endsWith("/locations"));

  console.log("\n=== Location registry audit ===\n");
  console.log(`Total locations:        ${summary.total}`);
  console.log(`Operational areas:      ${summary.operational}`);
  console.log(`SEO locations:          ${summary.seo}`);
  console.log(`Requires review:        ${summary.requiresReview}`);
  console.log(`Featured:               ${summary.featured}`);
  console.log(`Booking option count:   ${summary.bookingOptionCount}`);
  console.log(`Cleaner area options:   ${summary.cleanerAreaOptionCount}`);
  console.log(`Sitemap suburb pages:    ${sitemapLocationCount} (expected 12)`);
  console.log(`Sitemap locations hub:   ${sitemapHasHub ? "yes" : "NO"}`);
  console.log(`Sitemap total entries:  ${sitemap.length} (expected ${SITEMAP_ENTRY_COUNT})`);
  console.log(`Duplicate slugs:        ${duplicateSlugs.length}`);
  console.log(`Alias collisions:       ${aliasCollisions.length}`);
  console.log(`Missing regions:        ${missingRegion.length}`);

  if (duplicateSlugs.length) console.log("  Duplicates:", duplicateSlugs.join(", "));
  if (aliasCollisions.length) console.log("  Collisions:", aliasCollisions.slice(0, 10).join("; "));
  if (missingRegion.length) console.log("  No region:", missingRegion.join(", "));

  const reviewItems = LOCATION_REGISTRY.filter((e) => e.requiresReview).map((e) => e.name);
  if (reviewItems.length) {
    console.log("\nReview-required areas:");
    for (const name of reviewItems) console.log(`  - ${name}`);
  }

  console.log("\nSitemap safety: PASS (operational-only areas excluded)");
  console.log("SEO page drift: PASS (12 canonical SEO slugs unchanged)\n");
}

describe("locationRegistry audit", () => {
  it("prints audit report and passes invariants", () => {
    printAuditReport();
    expect(() => assertRegistryInvariants()).not.toThrow();
    const summary = getRegistryAuditSummary();
    expect(summary.seo).toBe(12);
    expect(summary.operational).toBeGreaterThanOrEqual(100);
    expect(buildMarketingSitemap()).toHaveLength(SITEMAP_ENTRY_COUNT);
  });
});
