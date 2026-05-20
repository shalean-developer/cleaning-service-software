import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isMarketingSectionId } from "./scrollToSection";

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("scrollToSection", () => {
  it("recognizes homepage section ids", () => {
    expect(isMarketingSectionId("services")).toBe(true);
    expect(isMarketingSectionId("faq")).toBe(true);
    expect(isMarketingSectionId("unknown")).toBe(false);
  });

  it("only reads legacy hashes to clear them (never sets hash)", () => {
    const source = readSource("src/lib/ui/scrollToSection.ts");
    expect(source).toContain("replaceState");
    expect(source).not.toContain("hashchange");
    expect(source).not.toMatch(/location\.hash\s*=/);
  });
});
