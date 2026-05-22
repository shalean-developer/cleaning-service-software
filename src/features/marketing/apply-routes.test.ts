import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPLY_FORM_PAGE_PATH,
  APPLY_HERO,
  APPLY_LANDING_CTA,
} from "./apply-page-content";
import { APPLY_PAGE_PATH } from "./marketing-routes";
import { buildMarketingSitemap } from "./sitemap";

describe("apply routes split", () => {
  it("landing CTAs point to application form route", () => {
    expect(APPLY_HERO.primaryHref).toBe("/apply/application-form");
    expect(APPLY_LANDING_CTA.href).toBe("/apply/application-form");
    expect(APPLY_FORM_PAGE_PATH).toBe("/apply/application-form");
  });

  it("landing page sections exclude embedded form", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/marketing/apply/ApplyPageSections.tsx"),
      "utf8",
    );
    expect(source).not.toContain("CleanerApplyForm");
    expect(source).toContain("APPLY_LANDING_CTA");
    expect(source).toContain("APPLY_LANDING_CTA.href");
  });

  it("application form page renders wizard only", () => {
    const pageSource = readFileSync(
      path.join(
        process.cwd(),
        "src/app/(marketing)/apply/application-form/page.tsx",
      ),
      "utf8",
    );
    const sectionsSource = readFileSync(
      path.join(
        process.cwd(),
        "src/components/marketing/apply/ApplyFormPageSections.tsx",
      ),
      "utf8",
    );
    expect(pageSource).toContain("buildMarketingNoindexMetadata");
    expect(pageSource).toContain("ApplyFormPageSections");
    expect(sectionsSource).toContain("CleanerApplyForm");
    expect(pageSource).toContain("Application form");
    expect(sectionsSource).toContain("APPLY_FORM_PAGE_HEADER");
  });

  it("sitemap includes /apply but not application form", () => {
    const urls = buildMarketingSitemap().map((e) => e.url);
    expect(urls.some((u) => u.endsWith(APPLY_PAGE_PATH))).toBe(true);
    expect(urls.some((u) => u.endsWith(APPLY_FORM_PAGE_PATH))).toBe(false);
  });

  it("form metadata uses noindex follow", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/app/(marketing)/apply/application-form/page.tsx",
      ),
      "utf8",
    );
    expect(source).toContain("buildMarketingNoindexMetadata");
  });
});
