import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CustomerHomePage", () => {
  it("uses hub content instead of duplicating the bookings list", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/(customer)/customer/page.tsx"),
      "utf8",
    );
    expect(source).toContain("CustomerHomeContent");
    expect(source).not.toContain("CustomerBookingsListContent");
    expect(source).not.toContain("listCustomerBookings");
  });

  it("keeps full bookings list on the bookings route", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/(customer)/customer/bookings/page.tsx"),
      "utf8",
    );
    expect(source).toContain("CustomerBookingsListContent");
    expect(source).toContain("CustomerBookingsPageHeader");
    expect(source).toContain("listCustomerBookings");
  });
});
