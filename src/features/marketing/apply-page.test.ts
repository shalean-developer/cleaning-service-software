import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPLY_PAGE_META,
  APPLY_PAGE_PATH,
} from "./apply-page-content";
import { APPLY_PATH, CLEANER_SIGN_IN_PATH } from "./constants";

describe("apply page", () => {
  it("exports SEO metadata and canonical path", () => {
    expect(APPLY_PAGE_PATH).toBe("/apply");
    expect(APPLY_PAGE_META.title).toContain("Apply to Work with Shalean");
    expect(APPLY_PAGE_META.description.length).toBeGreaterThan(40);
  });

  it("marketing Apply path is not cleaner sign-in", () => {
    expect(APPLY_PATH).toBe("/apply");
    expect(CLEANER_SIGN_IN_PATH).toContain("/sign-in");
    expect(APPLY_PATH).not.toBe(CLEANER_SIGN_IN_PATH);
  });

  it("page module sets indexable metadata", () => {
    const pagePath = path.join(
      process.cwd(),
      "src/app/(marketing)/apply/page.tsx",
    );
    const source = readFileSync(pagePath, "utf8");
    expect(source).toContain("buildMarketingMetadata");
    expect(source).toContain("APPLY_PAGE_PATH");
    expect(source).toContain("buildWebPageSchema");
    expect(source).toContain("buildFaqPageSchema");
  });

  it("landing page does not embed the application form", () => {
    const sectionsPath = path.join(
      process.cwd(),
      "src/components/marketing/apply/ApplyPageSections.tsx",
    );
    const source = readFileSync(sectionsPath, "utf8");
    expect(source).not.toContain("CleanerApplyForm");
    expect(source).toContain("APPLY_LANDING_CTA");
  });

  it("form component posts to public API only", () => {
    const formPath = path.join(
      process.cwd(),
      "src/components/marketing/apply/CleanerApplyForm.tsx",
    );
    const source = readFileSync(formPath, "utf8");
    expect(source).toContain('fetch("/api/cleaner-applications"');
    expect(source).not.toContain("requireServiceRoleClient");
    expect(source).toContain("saveCleanerApplyDraft");
    expect(source).toContain("CLEANER_APPLY_FORM_STEPS");
  });

  it("application form shows generated cleaner identity instead of email input", () => {
    const formPath = path.join(
      process.cwd(),
      "src/components/marketing/apply/CleanerApplyForm.tsx",
    );
    const source = readFileSync(formPath, "utf8");
    expect(source).toContain("CleanerIdentityPreview");
    expect(source).toContain("buildCleanerIdentityEmail");
    expect(source).not.toMatch(/id="email"/);
    expect(source).not.toMatch(/type="email"/);
  });
});
