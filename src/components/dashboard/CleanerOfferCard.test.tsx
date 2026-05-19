import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CleanerOfferCard } from "./CleanerOfferCard";
import { testCleanerOfferListItem } from "@/test/fixtures";

const pastOffer = testCleanerOfferListItem({
  offerId: "offer-2",
  status: "declined",
  scheduleLabel: "Sat 19 May, 14:00–16:00",
  locationSummary: "Sandton",
  serviceLabel: "Standard clean",
});

describe("CleanerOfferCard", () => {
  it("wires expiry chip and mobile earnings hierarchy in source", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/CleanerOfferCard.tsx"),
      "utf8",
    );

    expect(source).toContain("OfferExpiryChip");
    expect(source).toContain("formatOfferExpiryDisplay");
    expect(source).toContain("CLEANER_SERVICE_EYEBROW_CLASS");
    expect(source).toContain("CleanerPayDisplay");
    expect(source).toContain("CLEANER_META_LINE_CLASS");
    expect(source).toContain("OfferActions");
    expect(source).toContain("serviceLabel={offer.serviceLabel}");
    expect(source).toContain("scheduleLabel={offer.scheduleLabel}");
    expect(source).toContain("earningsLabel={offer.earningsLabel}");
  });

  it("renders past offers without accept/decline actions", () => {
    const html = renderToStaticMarkup(<CleanerOfferCard offer={pastOffer} />);
    expect(html).toContain("Declined");
    expect(html).toContain("Standard clean");
    expect(html).not.toContain("/api/cleaner/offers/");
    expect(html).not.toContain(">Accept<");
  });
});
