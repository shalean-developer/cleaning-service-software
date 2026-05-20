import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("cleaner offers page Stage 6F-2a wiring", () => {
  it("uses partition helper and section headers", () => {
    const source = readPage("src/app/(cleaner)/cleaner/offers/page.tsx");

    expect(source).toContain("partitionCleanerOffers");
    expect(source).toContain("CleanerOfferCard");
    expect(source).toContain("Needs your response");
    expect(source).toContain("PastOffersCollapsible");
    expect(source).not.toContain("OfferActions");
  });

  it("does not conflate fetch error with empty list", () => {
    const source = readPage("src/app/(cleaner)/cleaner/offers/page.tsx");
    expect(source).toContain("DashboardFetchError");
    expect(source).toContain("!result.ok");
  });
});
