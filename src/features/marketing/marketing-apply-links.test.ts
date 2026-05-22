import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APPLY_PATH, CLEANER_SIGN_IN_PATH, HEADER_PRIMARY_NAV } from "./constants";

describe("marketing apply links", () => {
  it("header Apply points to /apply not sign-in", () => {
    const apply = HEADER_PRIMARY_NAV.find((l) => l.label === "Apply");
    expect(apply?.href).toBe(APPLY_PATH);
    expect(apply?.href).not.toBe(CLEANER_SIGN_IN_PATH);
  });

  it("about careers CTA uses apply path", () => {
    const contentPath = path.join(process.cwd(), "src/features/marketing/about-page-content.ts");
    const source = readFileSync(contentPath, "utf8");
    expect(source).toContain("APPLY_PATH");
    expect(source).not.toMatch(/ctaHref:\s*CLEANER_SIGN_IN_PATH/);
  });

  it("services hub apply card uses apply path", () => {
    const contentPath = path.join(
      process.cwd(),
      "src/features/marketing/services-hub-content.ts",
    );
    const source = readFileSync(contentPath, "utf8");
    expect(source).toContain("href: APPLY_PATH");
  });
});
