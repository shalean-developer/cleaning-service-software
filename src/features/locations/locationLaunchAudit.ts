import { readFileSync } from "node:fs";
import path from "node:path";
import { SERVICE_SEO_PATHS } from "@/features/marketing/constants";
import {
  APPLY_FORM_PAGE_PATH,
  LOCATION_SEO_SLUGS,
  LOCATIONS_HUB_PATH,
  SERVICES_HUB_PATH,
} from "@/features/marketing/marketing-routes";
import { legacyLocationPathFromSlug, buildLocationLegacyRedirects } from "@/features/marketing/locationRedirects";
import { LOCATION_SEO_SLUG_LIST } from "@/features/marketing/locationSlugList";
import {
  getLocationAuthority,
  LOCATION_REGIONS,
  assertLocationRegionsComplete,
} from "@/features/marketing/locationAuthorityContent";
import { getNearbyLocationLinks } from "@/features/marketing/locationNearbyAreas";
import {
  assertAllAreasReceiveServiceInboundLinks,
  assertServiceCrossLinkPathsCanonical,
  getServiceLocationCrossLinks,
} from "@/features/marketing/serviceLocationCrossLinks";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import { DEFAULT_MARKETING_SITE_URL, getMarketingSiteUrl } from "@/features/marketing/siteUrl";
import {
  buildFaqPageSchema,
  buildItemListSchema,
  buildJsonLdGraph,
  buildLocationSuburbWebPageSchema,
  buildLocationsHubWebPageSchema,
  buildOrganizationSchema,
} from "@/features/marketing/seo";
import { LOCATION_SEO_CONTENT, isLocationSeoSlug } from "@/features/marketing/seo-pages";
import { buildMarketingSitemap, PRICING_SITEMAP_PATH, SITEMAP_ENTRY_COUNT } from "@/features/marketing/sitemap";
import {
  assertRegistryInvariants,
  getOperationalServiceAreas,
  getRegistryAuditSummary,
  getSeoLocations,
} from "./locationRegistry";

export const INVALID_LOCATION_SLUG_SAMPLE = "not-a-valid-suburb-cape-town" as const;
export const OPERATIONAL_ONLY_SLUG_SAMPLE = "atlantis-cape-town" as const;

export type LaunchAuditIssue = { code: string; message: string };

export function getLaunchCrawlPaths(): string[] {
  const servicePaths = Object.values(SERVICE_SEO_PATHS);
  const canonicalLocations = LOCATION_SEO_SLUGS.map((slug) => `/locations/${slug}`);
  const legacyLocations = LOCATION_SEO_SLUG_LIST.map((slug) => legacyLocationPathFromSlug(slug));

  return [
    LOCATIONS_HUB_PATH,
    ...canonicalLocations,
    ...legacyLocations,
    `/locations/${INVALID_LOCATION_SLUG_SAMPLE}`,
    `/locations/${OPERATIONAL_ONLY_SLUG_SAMPLE}`,
    SERVICES_HUB_PATH,
    ...servicePaths,
    PRICING_SITEMAP_PATH,
  ];
}

export function validateSitemapLaunch(): LaunchAuditIssue[] {
  const issues: LaunchAuditIssue[] = [];
  const baseUrl = getMarketingSiteUrl();
  const entries = buildMarketingSitemap();
  const urls = entries.map((e) => e.url);

  if (entries.length !== SITEMAP_ENTRY_COUNT) {
    issues.push({
      code: "SITEMAP_COUNT",
      message: `Expected ${SITEMAP_ENTRY_COUNT} sitemap entries, got ${entries.length}`,
    });
  }

  if (!urls.some((u) => u.endsWith("/locations"))) {
    issues.push({ code: "SITEMAP_HUB", message: "Missing /locations hub in sitemap" });
  }

  const suburbPages = urls.filter((u) => /\/locations\/[^/]+$/.test(u));
  if (suburbPages.length !== 12) {
    issues.push({
      code: "SITEMAP_SUBURBS",
      message: `Expected 12 location suburb URLs, got ${suburbPages.length}`,
    });
  }

  for (const entry of getOperationalServiceAreas()) {
    if (entry.isSeoLocation) continue;
    const operationalUrl = `${baseUrl}/locations/${entry.slug}-cape-town`;
    if (urls.includes(operationalUrl)) {
      issues.push({
        code: "SITEMAP_OPERATIONAL",
        message: `Operational-only area in sitemap: ${entry.name}`,
      });
    }
  }

  if (urls.some((u) => u.endsWith(APPLY_FORM_PAGE_PATH))) {
    issues.push({
      code: "SITEMAP_APPLY_FORM",
      message: `${APPLY_FORM_PAGE_PATH} must not be in sitemap`,
    });
  }

  if (urls.some((u) => u.includes("#"))) {
    issues.push({ code: "SITEMAP_HASH", message: "Sitemap URLs must not contain hash fragments" });
  }

  if (urls.some((u) => u.includes("localhost") || u.includes("vercel.app"))) {
    issues.push({ code: "SITEMAP_HOST", message: "Sitemap must not use localhost or vercel.app" });
  }

  if (!urls.every((u) => u.startsWith(DEFAULT_MARKETING_SITE_URL))) {
    issues.push({
      code: "SITEMAP_APEX",
      message: `All sitemap URLs must use apex ${DEFAULT_MARKETING_SITE_URL}`,
    });
  }

  if (urls.some((u) => u.endsWith("/service"))) {
    issues.push({ code: "SITEMAP_LEGACY_SERVICE", message: "Sitemap must not include /service" });
  }

  return issues;
}

export function validateRobotsLaunch(): LaunchAuditIssue[] {
  const issues: LaunchAuditIssue[] = [];
  const source = readProjectFile("src/app/robots.ts");

  if (source.includes('disallow: "/locations"') || source.includes('"/locations/"')) {
    issues.push({ code: "ROBOTS_BLOCK", message: "robots.txt must not block /locations" });
  }
  if (!source.includes("sitemap:") && !source.includes("sitemap")) {
    issues.push({ code: "ROBOTS_SITEMAP", message: "robots.ts must reference sitemap" });
  }

  return issues;
}

export function validateRedirectConfig(): LaunchAuditIssue[] {
  const issues: LaunchAuditIssue[] = [];
  const redirects = buildLocationLegacyRedirects();

  if (redirects.length !== 12) {
    issues.push({
      code: "REDIRECT_COUNT",
      message: `Expected 12 legacy location redirects, got ${redirects.length}`,
    });
  }

  for (const rule of redirects) {
    if (!rule.permanent) {
      issues.push({ code: "REDIRECT_PERMANENT", message: `${rule.source} must be permanent` });
    }
    if (!rule.destination.endsWith("-cape-town")) {
      issues.push({
        code: "REDIRECT_CANONICAL",
        message: `${rule.source} must redirect to canonical -cape-town slug`,
      });
    }
    if (rule.source === rule.destination) {
      issues.push({ code: "REDIRECT_LOOP", message: `Redirect loop: ${rule.source}` });
    }
  }

  const nextConfig = readProjectFile("next.config.ts");
  if (!nextConfig.includes("buildLocationLegacyRedirects")) {
    issues.push({
      code: "REDIRECT_WIRED",
      message: "next.config.ts must wire buildLocationLegacyRedirects",
    });
  }

  return issues;
}

export function validateLocationMetadata(): LaunchAuditIssue[] {
  const issues: LaunchAuditIssue[] = [];
  const titles = new Set<string>();
  const descriptions = new Set<string>();

  const hubMeta = buildMarketingMetadata({
    title: "Cleaning Service Areas Cape Town | Shalean",
    description:
      "Shalean cleaning services across Cape Town suburbs — Sea Point, Claremont, Camps Bay, Century City, Bellville, and more.",
    path: LOCATIONS_HUB_PATH,
  });

  if (!hubMeta.title || !hubMeta.description) {
    issues.push({ code: "META_HUB", message: "/locations hub missing title or description" });
  }
  if (isNoindexRobots(hubMeta.robots)) {
    issues.push({ code: "META_HUB_ROBOTS", message: "/locations hub must be index,follow" });
  }

  for (const slug of LOCATION_SEO_SLUGS) {
    if (!isLocationSeoSlug(slug)) continue;
    const content = LOCATION_SEO_CONTENT[slug];
    const meta = buildMarketingMetadata({
      title: content.metaTitle,
      description: content.metaDescription,
      path: content.path,
    });

    if (!content.h1?.trim()) {
      issues.push({ code: "META_H1", message: `${slug} missing H1` });
    }
    if (!meta.title) issues.push({ code: "META_TITLE", message: `${slug} missing title` });
    if (!meta.description) issues.push({ code: "META_DESC", message: `${slug} missing description` });
    if (!meta.alternates?.canonical) {
      issues.push({ code: "META_CANONICAL", message: `${slug} missing canonical` });
    }
    const canonical = String(meta.alternates?.canonical ?? "");
    if (!canonical.endsWith(content.path)) {
      issues.push({
        code: "META_CANONICAL_PATH",
        message: `${slug} canonical must match route path ${content.path}`,
      });
    }
    if (isNoindexRobots(meta.robots)) {
      issues.push({ code: "META_ROBOTS", message: `${slug} must be index,follow` });
    }
    if (!meta.openGraph?.title) {
      issues.push({ code: "META_OG", message: `${slug} missing OpenGraph title` });
    }

    if (titles.has(content.metaTitle)) {
      issues.push({ code: "META_DUP_TITLE", message: `Duplicate meta title: ${content.metaTitle}` });
    }
    titles.add(content.metaTitle);

    if (descriptions.has(content.metaDescription)) {
      issues.push({
        code: "META_DUP_DESC",
        message: `Duplicate meta description for ${slug}`,
      });
    }
    descriptions.add(content.metaDescription);
  }

  return issues;
}

export function validateStructuredData(): LaunchAuditIssue[] {
  const issues: LaunchAuditIssue[] = [];
  const webpageIds = new Set<string>();

  const hubGraph = buildJsonLdGraph([
    buildOrganizationSchema(),
    buildLocationsHubWebPageSchema({
      name: "Cleaning Services Across Cape Town",
      description: "Hub",
      path: LOCATIONS_HUB_PATH,
    }),
    buildItemListSchema(
      LOCATION_SEO_SLUGS.map((slug) => ({
        name: LOCATION_SEO_CONTENT[slug]!.area,
        path: LOCATION_SEO_CONTENT[slug]!.path,
      })),
    ),
  ]);

  const hubTypes = hubGraph["@graph"].map((n) => (n as { "@type"?: string })["@type"]);
  if (!hubTypes.includes("CollectionPage")) {
    issues.push({ code: "SCHEMA_HUB_COLLECTION", message: "Hub must include CollectionPage" });
  }
  if (!hubTypes.includes("ItemList")) {
    issues.push({ code: "SCHEMA_HUB_ITEMLIST", message: "Hub must include ItemList" });
  }

  for (const slug of LOCATION_SEO_SLUGS) {
    const content = LOCATION_SEO_CONTENT[slug]!;
    const authority = getLocationAuthority(slug);
    const suburbSchema = buildLocationSuburbWebPageSchema(content);
    const faqSchema = buildFaqPageSchema(authority.faqs);
    const graph = buildJsonLdGraph([
      buildOrganizationSchema(),
      suburbSchema,
      faqSchema,
      { "@type": "BreadcrumbList", itemListElement: [] },
    ]);

    const types = graph["@graph"].map((n) => (n as { "@type"?: string })["@type"]);
    if (!types.includes("WebPage")) {
      issues.push({ code: "SCHEMA_WEBPAGE", message: `${slug} must include WebPage` });
    }
    if (!types.includes("FAQPage")) {
      issues.push({ code: "SCHEMA_FAQ", message: `${slug} must include FAQPage` });
    }
    if (types.filter((t) => t === "LocalBusiness").length > 0) {
      issues.push({
        code: "SCHEMA_LOCALBUSINESS_BRANCH",
        message: `${slug} must not add duplicate LocalBusiness branch entity`,
      });
    }

    const pageId = (suburbSchema as { "@id"?: string })["@id"];
    if (!pageId) {
      issues.push({ code: "SCHEMA_WEBPAGE_ID", message: `${slug} WebPage missing @id` });
    } else if (webpageIds.has(pageId)) {
      issues.push({ code: "SCHEMA_DUP_ID", message: `Duplicate WebPage @id: ${pageId}` });
    } else {
      webpageIds.add(pageId);
    }

    const address = (suburbSchema as { areaServed?: { address?: { streetAddress?: string } } })
      .areaServed?.address;
    if (address?.streetAddress) {
      issues.push({
        code: "SCHEMA_FAKE_ADDRESS",
        message: `${slug} must not use streetAddress in area schema`,
      });
    }

    const firstFaqQ = faqSchema.mainEntity[0]?.name;
    const visibleQ = authority.faqs[0]?.question;
    if (firstFaqQ !== visibleQ) {
      issues.push({
        code: "SCHEMA_FAQ_MISMATCH",
        message: `${slug} FAQ schema question must match visible FAQ`,
      });
    }
  }

  const suburbPageSource = readProjectFile("src/app/(marketing)/locations/[slug]/page.tsx");
  if (suburbPageSource.includes("buildLocationBusinessSchema")) {
    issues.push({
      code: "SCHEMA_DEPRECATED_BUSINESS",
      message: "Suburb pages must not use deprecated buildLocationBusinessSchema",
    });
  }

  return issues;
}

export function validateInternalLinkGraph(): LaunchAuditIssue[] {
  const issues: LaunchAuditIssue[] = [];

  try {
    assertLocationRegionsComplete();
  } catch (e) {
    issues.push({
      code: "LINK_HUB_REGIONS",
      message: e instanceof Error ? e.message : "Hub regions incomplete",
    });
  }

  const hubAreas = LOCATION_REGIONS.flatMap((r) => r.areas);
  if (hubAreas.length !== 12) {
    issues.push({ code: "LINK_HUB_COUNT", message: "Hub must list exactly 12 suburbs" });
  }

  for (const slug of LOCATION_SEO_SLUGS) {
    const authority = getLocationAuthority(slug);
    const content = LOCATION_SEO_CONTENT[slug]!;

    if (!content.path.endsWith("-cape-town")) {
      issues.push({ code: "LINK_SHORT_SLUG", message: `${slug} path must use -cape-town suffix` });
    }

    const nearby = getNearbyLocationLinks(slug);
    if (nearby.length === 0) {
      issues.push({ code: "LINK_NEARBY", message: `${slug} must have nearby area links` });
    }
    for (const link of nearby) {
      if (!link.path.endsWith("-cape-town")) {
        issues.push({ code: "LINK_NEARBY_CANONICAL", message: `${slug} nearby link not canonical` });
      }
    }

    if (authority.popularServices.length < 3) {
      issues.push({ code: "LINK_SERVICES", message: `${slug} needs popular service links` });
    }
    for (const service of authority.popularServices) {
      if (!service.href.startsWith("/services/")) {
        issues.push({ code: "LINK_SERVICE_PATH", message: `${slug} invalid service href` });
      }
      if (!service.linkLabel.includes(" in ")) {
        issues.push({ code: "LINK_GENERIC_ANCHOR", message: `${slug} service link needs descriptive anchor` });
      }
    }
  }

  try {
    assertAllAreasReceiveServiceInboundLinks();
    assertServiceCrossLinkPathsCanonical();
  } catch (e) {
    issues.push({
      code: "LINK_SERVICE_CROSS",
      message: e instanceof Error ? e.message : "Service cross-links invalid",
    });
  }

  for (const serviceSlug of Object.keys(SERVICE_SEO_PATHS) as Array<keyof typeof SERVICE_SEO_PATHS>) {
    const { links } = getServiceLocationCrossLinks(serviceSlug);
    for (const link of links) {
      if (!link.href.endsWith("-cape-town")) {
        issues.push({
          code: "LINK_SERVICE_LOCATION",
          message: `${serviceSlug} links non-canonical location`,
        });
      }
    }
  }

  const crossLinksSource = readProjectFile("src/features/marketing/serviceLocationCrossLinks.ts");
  if (crossLinksSource.includes('"/service"') || crossLinksSource.includes("'/service'")) {
    issues.push({ code: "LINK_LEGACY_SERVICE", message: "Cross-links must not reference /service" });
  }

  const staticParamsSource = readProjectFile("src/app/(marketing)/locations/[slug]/page.tsx");
  if (staticParamsSource.includes("getOperationalServiceAreas")) {
    issues.push({
      code: "STATIC_OPERATIONAL",
      message: "generateStaticParams must not include operational-only areas",
    });
  }
  if (!staticParamsSource.includes("LOCATION_SEO_SLUGS")) {
    issues.push({
      code: "STATIC_SEO_ONLY",
      message: "generateStaticParams must use LOCATION_SEO_SLUGS only",
    });
  }

  return issues;
}

export function validateRegistryLaunch(): LaunchAuditIssue[] {
  const issues: LaunchAuditIssue[] = [];
  const summary = getRegistryAuditSummary();

  try {
    assertRegistryInvariants();
  } catch (e) {
    issues.push({
      code: "REGISTRY_INVARIANT",
      message: e instanceof Error ? e.message : "Registry invariants failed",
    });
  }

  if (summary.seo !== 12) {
    issues.push({ code: "REGISTRY_SEO", message: `Expected 12 SEO locations, got ${summary.seo}` });
  }
  if (summary.operational !== 146) {
    issues.push({
      code: "REGISTRY_OPERATIONAL",
      message: `Expected 146 operational areas, got ${summary.operational}`,
    });
  }
  if (summary.requiresReview !== 0) {
    issues.push({
      code: "REGISTRY_REVIEW",
      message: `Expected requiresReview=0, got ${summary.requiresReview}`,
    });
  }
  if (summary.bookingOptionCount !== 146) {
    issues.push({
      code: "REGISTRY_BOOKING",
      message: `Expected 146 booking options, got ${summary.bookingOptionCount}`,
    });
  }

  const seoNames = getSeoLocations().map((e) => e.name).sort().join(",");
  const unchanged =
    seoNames.includes("Sea Point") && seoNames.includes("Table View") && summary.seo === 12;
  if (!unchanged) {
    issues.push({ code: "REGISTRY_SEO_LIST", message: "SEO location list drift detected" });
  }

  return issues;
}

export function runStaticLaunchAudit(): {
  issues: LaunchAuditIssue[];
  sitemap: ReturnType<typeof buildMarketingSitemap>;
  registry: ReturnType<typeof getRegistryAuditSummary>;
} {
  const issues = [
    ...validateSitemapLaunch(),
    ...validateRobotsLaunch(),
    ...validateRedirectConfig(),
    ...validateLocationMetadata(),
    ...validateStructuredData(),
    ...validateInternalLinkGraph(),
    ...validateRegistryLaunch(),
  ];

  return {
    issues,
    sitemap: buildMarketingSitemap(),
    registry: getRegistryAuditSummary(),
  };
}

export function printLaunchAuditReport(result: ReturnType<typeof runStaticLaunchAudit>): void {
  const { issues, sitemap, registry } = result;
  const suburbCount = sitemap.filter((e) => /\/locations\/[^/]+$/.test(e.url)).length;

  console.log("\n=== Location launch audit (static) ===\n");
  console.log(`Sitemap total entries:     ${sitemap.length} (expected ${SITEMAP_ENTRY_COUNT})`);
  console.log(`Sitemap location suburbs:  ${suburbCount} (expected 12)`);
  console.log(`Sitemap apex:              ${DEFAULT_MARKETING_SITE_URL}`);
  console.log(`Registry operational:      ${registry.operational} (expected 146)`);
  console.log(`Registry SEO:              ${registry.seo} (expected 12)`);
  console.log(`Requires review:           ${registry.requiresReview} (expected 0)`);
  console.log(`Launch crawl paths:        ${getLaunchCrawlPaths().length} URLs defined`);

  if (issues.length === 0) {
    console.log("\nStatic launch checks: PASS\n");
    return;
  }

  console.log(`\nStatic launch checks: FAIL (${issues.length} issue(s))\n`);
  for (const issue of issues) {
    console.log(`  [${issue.code}] ${issue.message}`);
  }
  console.log("");
}

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function isNoindexRobots(robots: unknown): boolean {
  if (!robots || typeof robots !== "object") return false;
  const record = robots as { index?: boolean };
  return record.index === false;
}
