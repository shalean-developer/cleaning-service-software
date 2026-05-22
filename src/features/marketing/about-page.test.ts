import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ABOUT_PAGE_FAQ, ABOUT_PAGE_HERO, ABOUT_PAGE_META, ABOUT_PAGE_PATH } from "./about-page";
import { buildMarketingMetadata } from "./metadata";
import { buildAboutPageSchema, buildOrganizationSchema } from "./seo";
import { getMarketingCanonicalUrl } from "./siteUrl";

const repoRoot = join(import.meta.dirname, "..", "..", "..");

describe("about page", () => {
  it("uses canonical /about path", () => {
    expect(ABOUT_PAGE_PATH).toBe("/about");
  });

  it("positions as Cape Town home services platform", () => {
    expect(ABOUT_PAGE_HERO.h1).toContain("Cape Town");
    expect(ABOUT_PAGE_META.description).toMatch(/platform/i);
  });

  it("sets crawlable metadata for /about", () => {
    const meta = buildMarketingMetadata({
      title: ABOUT_PAGE_META.title,
      description: ABOUT_PAGE_META.description,
      path: ABOUT_PAGE_PATH,
      keywords: [...ABOUT_PAGE_META.keywords],
    });
    expect(meta.alternates?.canonical).toBe(getMarketingCanonicalUrl("/about"));
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("emits AboutPage and Organization schema", () => {
    const about = buildAboutPageSchema({
      name: "Modern home services built for Cape Town",
      description: ABOUT_PAGE_META.description,
      path: ABOUT_PAGE_PATH,
    });
    const org = buildOrganizationSchema({ description: ABOUT_PAGE_META.description });
    expect(about["@type"]).toBe("AboutPage");
    expect(about.url).toBe(getMarketingCanonicalUrl("/about"));
    expect(org["@type"]).toBe("Organization");
    expect(org.logo).toContain("/marketing/shalean-logo.png");
  });

  it("includes platform FAQ items for structured data", () => {
    expect(ABOUT_PAGE_FAQ.length).toBeGreaterThanOrEqual(4);
    expect(ABOUT_PAGE_FAQ[0]?.question).toMatch(/platform/i);
  });

  it("ships editorial AboutPageSections with hero and FAQ", () => {
    const pagePath = join(repoRoot, "src", "app", "(marketing)", "about", "page.tsx");
    const sectionsPath = join(
      repoRoot,
      "src",
      "components",
      "marketing",
      "about",
      "AboutPageSections.tsx",
    );
    const pageSource = readFileSync(pagePath, "utf8");
    const sectionsSource = readFileSync(sectionsPath, "utf8");
    expect(pageSource).toContain("AboutPageSections");
    expect(pageSource).toContain("buildOrganizationSchema");
    expect(pageSource).toContain("buildFaqPageSchema");
    expect(sectionsSource).toContain("ABOUT_PAGE_MISSION");
    expect(sectionsSource).toContain("FaqAccordion");
    expect(sectionsSource).toContain("showAbout={false}");
  });
});
