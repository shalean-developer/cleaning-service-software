import { describe, expect, it } from "vitest";
import { partitionAdminAssignmentOffers } from "./adminBookingDetailDisplay";

describe("partitionAdminAssignmentOffers", () => {
  it("separates open offers from historical offers", () => {
    const offers = [
      { id: "1", status: "offered" as const },
      { id: "2", status: "declined" as const },
      { id: "3", status: "accepted" as const },
    ];
    const { activeOffers, pastOffers } = partitionAdminAssignmentOffers(offers);
    expect(activeOffers).toHaveLength(1);
    expect(pastOffers).toHaveLength(2);
  });
});
