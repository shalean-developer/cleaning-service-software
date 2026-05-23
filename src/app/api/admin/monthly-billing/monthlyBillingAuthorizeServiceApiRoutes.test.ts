import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE_PATH = path.join(
  process.cwd(),
  "src/app/api/admin/monthly-billing/bookings/[bookingId]/authorize-service/route.ts",
);

describe("monthly billing authorize-service API route", () => {
  const source = readFileSync(ROUTE_PATH, "utf8");

  it("is POST-only admin route", () => {
    expect(source).toMatch(/export async function POST/);
    expect(source).not.toMatch(/export async function GET/);
    expect(source).toMatch(/requireApiUser\(\["admin"\]\)/);
    expect(source).toMatch(/authorizeMonthlyAccountServiceFacade/);
  });

  it("does not import finalizePaidBooking or Zoho invoice modules", () => {
    expect(source).not.toMatch(/finalizePaidBooking/);
    expect(source).not.toMatch(/@\/lib\/zoho\/invoices/);
  });
});
