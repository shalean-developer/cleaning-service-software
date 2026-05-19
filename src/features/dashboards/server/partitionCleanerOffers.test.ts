import { describe, expect, it } from "vitest";
import {
  canRespondToCleanerOffer,
  partitionCleanerOffers,
} from "./partitionCleanerOffers";
import { testCleanerOfferListItem } from "@/test/fixtures";

function offer(
  partial: Partial<ReturnType<typeof testCleanerOfferListItem>> &
    Pick<ReturnType<typeof testCleanerOfferListItem>, "offerId">,
) {
  return testCleanerOfferListItem(partial);
}

describe("partitionCleanerOffers", () => {
  it("groups needsResponse vs past offers", () => {
    const open = offer({ offerId: "o-open" });
    const expired = offer({
      offerId: "o-expired",
      isExpired: true,
      offeredAt: "2026-05-18T11:00:00.000Z",
    });
    const accepted = offer({
      offerId: "o-accepted",
      status: "accepted",
      offeredAt: "2026-05-19T10:00:00.000Z",
    });
    const declined = offer({
      offerId: "o-declined",
      status: "declined",
      offeredAt: "2026-05-18T09:00:00.000Z",
    });

    const { needsResponse, pastOffers } = partitionCleanerOffers([
      declined,
      accepted,
      expired,
      open,
    ]);

    expect(needsResponse.map((o) => o.offerId)).toEqual(["o-open"]);
    expect(pastOffers.map((o) => o.offerId)).toEqual([
      "o-accepted",
      "o-expired",
      "o-declined",
    ]);
  });

  it("sorts needsResponse by expiresAt ascending", () => {
    const later = offer({
      offerId: "later",
      expiresAt: "2026-05-20T18:00:00.000Z",
    });
    const sooner = offer({
      offerId: "sooner",
      expiresAt: "2026-05-20T10:00:00.000Z",
    });

    const { needsResponse } = partitionCleanerOffers([later, sooner]);
    expect(needsResponse.map((o) => o.offerId)).toEqual(["sooner", "later"]);
  });

  it("identifies canRespond only for open offered rows", () => {
    expect(
      canRespondToCleanerOffer(
        offer({ offerId: "open", status: "offered", isExpired: false }),
      ),
    ).toBe(true);
    expect(
      canRespondToCleanerOffer(
        offer({ offerId: "exp", status: "offered", isExpired: true }),
      ),
    ).toBe(false);
    expect(
      canRespondToCleanerOffer(offer({ offerId: "dec", status: "declined" })),
    ).toBe(false);
  });
});
