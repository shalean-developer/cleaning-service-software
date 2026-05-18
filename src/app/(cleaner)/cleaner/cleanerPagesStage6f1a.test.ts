import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cleanerPages = [
  "src/app/(cleaner)/cleaner/page.tsx",
  "src/app/(cleaner)/cleaner/offers/page.tsx",
  "src/app/(cleaner)/cleaner/jobs/page.tsx",
  "src/app/(cleaner)/cleaner/jobs/[bookingId]/page.tsx",
  "src/app/(cleaner)/cleaner/earnings/page.tsx",
] as const;

function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("cleaner pages Stage 6F-1a wiring", () => {
  it.each(cleanerPages)("uses shared cleaner nav on %s", (pagePath) => {
    const source = readPage(pagePath);
    expect(source).toContain("CLEANER_NAV_ITEMS");
    expect(source).toContain("nav={[...CLEANER_NAV_ITEMS]}");
    expect(source).not.toMatch(/nav=\{\[\s*\{ href: "\/cleaner"/);
  });

  it("uses cleaner job list/detail components with status labels", () => {
    const home = readPage("src/app/(cleaner)/cleaner/page.tsx");
    const jobs = readPage("src/app/(cleaner)/cleaner/jobs/page.tsx");
    const detail = readPage("src/app/(cleaner)/cleaner/jobs/[bookingId]/page.tsx");

    expect(home).toContain("CleanerJobListCard");
    expect(jobs).toContain("CleanerJobListCard");
    expect(detail).toContain("CleanerJobStatusHero");
    expect(readPage("src/components/dashboard/cleaner/CleanerJobListCard.tsx")).toContain(
      "labelForCleanerJobStatus",
    );
  });

  it("keeps payout-specific labels on earnings page", () => {
    const earnings = readPage("src/app/(cleaner)/cleaner/earnings/page.tsx");
    expect(earnings).toContain("labelForPayoutStatus");
    expect(earnings).not.toContain("labelForCleanerJobStatus");
  });
});
