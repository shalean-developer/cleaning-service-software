import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SERVICE_SEO_PATHS } from "./constants";
import { SERVICE_SEO_SLUGS } from "./seo-pages";
import { buildMarketingMetadata } from "./metadata";
import { SERVICES_HUB_PATH } from "./marketing-routes";
import { buildMarketingSitemap } from "./sitemap";
import { getMarketingCanonicalUrl } from "./siteUrl";

const repoRoot = join(import.meta.dirname, "..", "..", "..");

describe("services hub", () => {
  it("exports hub path and page module", () => {
    expect(SERVICES_HUB_PATH).toBe("/services");
    const pagePath = join(
      repoRoot,
      "src",
      "app",
      "(marketing)",
      "services",
      "page.tsx",
    );
    expect(readFileSync(pagePath, "utf8")).toContain("ServicesHubPage");
  });

  it("sets canonical metadata for /services", () => {
    const meta = buildMarketingMetadata({
      title: "Cleaning Services Cape Town | Shalean",
      description: "Test",
      path: SERVICES_HUB_PATH,
    });
    expect(meta.alternates?.canonical).toBe(getMarketingCanonicalUrl("/services"));
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("includes /services in sitemap and excludes /service", () => {
    const urls = buildMarketingSitemap().map((e) => e.url);
    expect(urls.some((u) => u.endsWith(SERVICES_HUB_PATH))).toBe(true);
    expect(urls.some((u) => u.endsWith("/service"))).toBe(false);
    expect(urls.every((u) => !u.includes("#"))).toBe(true);
    for (const slug of SERVICE_SEO_SLUGS) {
      expect(urls.some((u) => u.endsWith(`/services/${slug}`))).toBe(true);
    }
  });

  it("service money page breadcrumbs target /services", () => {
    const pagePath = join(
      repoRoot,
      "src",
      "app",
      "(marketing)",
      "services",
      "[slug]",
      "page.tsx",
    );
    const source = readFileSync(pagePath, "utf8");
    expect(source).toContain('href: SERVICES_HUB_PATH');
    expect(source).toContain('path: SERVICES_HUB_PATH');
    expect(source).not.toMatch(/label: "Services", href: "\/"/);
  });

  it("redirects /service to /services in next.config", () => {
    const configPath = join(repoRoot, "next.config.ts");
    const source = readFileSync(configPath, "utf8");
    expect(source).toContain('source: "/service"');
    expect(source).toContain('destination: "/services"');
    expect(source).toContain("permanent: true");
  });

  it("redirects /about-us to /about in next.config", () => {
    const configPath = join(repoRoot, "next.config.ts");
    const source = readFileSync(configPath, "utf8");
    expect(source).toContain('source: "/about-us"');
    expect(source).toContain('destination: "/about"');
    expect(source).toContain("permanent: true");
  });

  it("off-homepage about nav uses /about page", () => {
    const routesPath = join(repoRoot, "src", "lib", "ui", "marketingSectionRoutes.ts");
    const source = readFileSync(routesPath, "utf8");
    expect(source).toContain("about: ABOUT_PAGE_PATH");
  });

  it("off-homepage services nav uses /services hub", () => {
    const routesPath = join(repoRoot, "src", "lib", "ui", "marketingSectionRoutes.ts");
    const source = readFileSync(routesPath, "utf8");
    expect(source).toContain("services: SERVICES_HUB_PATH");
  });

  it("footer and internal links reference services hub without /service paths", () => {
    const footerPath = join(
      repoRoot,
      "src",
      "components",
      "marketing",
      "sections",
      "MarketingFooter.tsx",
    );
    const internalPath = join(
      repoRoot,
      "src",
      "components",
      "marketing",
      "MarketingInternalLinks.tsx",
    );
    const footer = readFileSync(footerPath, "utf8");
    const internal = readFileSync(internalPath, "utf8");
    expect(footer).toContain("FOOTER_QUICK_LINKS");
    expect(footer).not.toContain("footer-services");
    expect(internal).toContain("All cleaning services");
    expect(footer).not.toMatch(/["']\/service["']/);
    expect(internal).not.toMatch(/["']\/service["']/);
  });

  it("lists all six service money page paths", () => {
    expect(Object.values(SERVICE_SEO_PATHS)).toHaveLength(6);
    expect(Object.values(SERVICE_SEO_PATHS).every((p) => p.startsWith("/services/"))).toBe(
      true,
    );
  });
});
