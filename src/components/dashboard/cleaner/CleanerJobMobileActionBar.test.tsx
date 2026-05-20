import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readComponent(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("CleanerJobMobileActionBar", () => {
  it("renders sticky mobile bar for assigned and in_progress only", () => {
    const source = readComponent(
      "src/components/dashboard/cleaner/CleanerJobMobileActionBar.tsx",
    );
    expect(source).toContain("fixed inset-x-0 bottom-0");
    expect(source).toContain("sm:hidden");
    expect(source).toContain('status !== "assigned"');
    expect(source).toContain("JobCompletionActions");
    expect(source).toContain("compact");
    expect(source).toContain("safe-area-inset-bottom");
  });
});
