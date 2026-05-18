import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CleanerOfferCard } from "./CleanerOfferCard";
import type { CleanerOfferListItem } from "@/features/dashboards/server/types";

const pastOffer: CleanerOfferListItem = {
  offerId: "offer-2",
  bookingId: "booking-1",
  status: "declined",
  expiresAt: "2026-05-20T14:00:00.000Z",
  offeredAt: "2026-05-18T10:00:00.000Z",
  scheduleLabel: "Sat 19 May, 14:00–16:00",
  locationSummary: "Sandton",
  serviceLabel: "Standard clean",
  earningsCents: 35000,
  earningsLabel: "R 350.00",
  isExpired: false,
};

describe("CleanerOfferCard", () => {
  it("wires expiry chip and mobile earnings hierarchy in source", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/CleanerOfferCard.tsx"),
      "utf8",
    );

    expect(source).toContain("OfferExpiryChip");
    expect(source).toContain("formatOfferExpiryDisplay");
    expect(source).toContain("text-sky-800");
    expect(source).toContain("Your pay");
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
