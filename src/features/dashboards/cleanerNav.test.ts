import { describe, expect, it } from "vitest";
import { CLEANER_NAV_ITEMS } from "./cleanerNav";

describe("CLEANER_NAV_ITEMS", () => {
  it("includes Home, Offers, Jobs, and Earnings in order", () => {
    expect(CLEANER_NAV_ITEMS.map((item) => item.label)).toEqual([
      "Home",
      "Offers",
      "Jobs",
      "Earnings",
    ]);
    expect(CLEANER_NAV_ITEMS.map((item) => item.href)).toEqual([
      "/cleaner",
      "/cleaner/offers",
      "/cleaner/jobs",
      "/cleaner/earnings",
    ]);
  });
});
