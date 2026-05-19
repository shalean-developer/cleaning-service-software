import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("cleaner earnings page", () => {
  it("uses shared earnings card and cleaner payout labels", () => {
    const source = readPage("src/app/(cleaner)/cleaner/earnings/page.tsx");

    expect(source).toContain("CleanerEarningsListCard");
    expect(source).toContain("CLEANER_EARNINGS_PAGE_TRUST_LINE");
    expect(source).toContain("CLEANER_EARNINGS_EMPTY");
    expect(source).not.toContain("labelForPayoutStatus");
  });

  it("renders helpful empty-state actions", () => {
    const source = readPage("src/app/(cleaner)/cleaner/earnings/page.tsx");

    expect(source).toContain('href="/cleaner/jobs"');
    expect(source).toContain('href="/cleaner/offers"');
    expect(source).toContain("View jobs");
    expect(source).toContain("Check offers");
  });
});
