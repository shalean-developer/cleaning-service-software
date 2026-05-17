import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("cleaner offers Stage 6F-2c-a wiring", () => {
  it("passes summary props from CleanerOfferCard to OfferActions", () => {
    const source = readFile("src/components/dashboard/CleanerOfferCard.tsx");

    expect(source).toContain("serviceLabel={offer.serviceLabel}");
    expect(source).toContain("scheduleLabel={offer.scheduleLabel}");
    expect(source).toContain("earningsLabel={offer.earningsLabel}");
  });

  it("does not change decline API route", () => {
    const source = readFile("src/app/api/cleaner/offers/[offerId]/decline/route.ts");

    expect(source).toContain("declineCleanerOffer");
    expect(source).not.toContain("request.json");
    expect(source).not.toContain("declineReason");
  });
});
