import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(): string {
  return readFileSync(
    path.join(process.cwd(), "src/components/dashboard/admin/AdminCustomerBookingCard.tsx"),
    "utf8",
  );
}

describe("AdminCustomerBookingCard", () => {
  it("links to admin booking detail and shows operational fields", () => {
    const source = readSource();
    expect(source).toContain("/admin/bookings/");
    expect(source).toContain("bookingReference");
    expect(source).toContain("serviceLabel");
    expect(source).toContain("labelForBookingStatus");
    expect(source).toContain("labelForPaymentStatus");
    expect(source).toContain("assignedCleanerLabel");
  });
});
