import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("useSectionScrollSpy", () => {
  it("uses IntersectionObserver without scroll event listeners", () => {
    const source = readSource("src/lib/ui/useSectionScrollSpy.ts");
    expect(source).toContain("IntersectionObserver");
    expect(source).not.toContain("addEventListener(\"scroll\"");
    expect(source).not.toContain("hashchange");
    expect(source).not.toContain("location.hash");
  });
});
