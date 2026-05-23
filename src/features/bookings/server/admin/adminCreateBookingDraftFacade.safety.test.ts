import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const facadePath = path.join(
  process.cwd(),
  "src/features/bookings/server/admin/adminCreateBookingDraftFacade.ts",
);
const routePath = path.join(process.cwd(), "src/app/api/admin/bookings/draft/route.ts");

describe("admin assisted booking draft safety (static)", () => {
  it("facade must not import payment or assignment modules", () => {
    const source = readFileSync(facadePath, "utf8");
    expect(source).not.toMatch(/\bfinalizePaidBooking\b/);
    expect(source).not.toMatch(/\binitializePayment\b/);
    expect(source).not.toMatch(/\bprocessPaystackChargeSuccess\b/);
    expect(source).not.toMatch(/\brunPostPaymentAssignmentDispatch\b/);
    expect(source).not.toMatch(/\brunAssignmentAfterPayment\b/);
    expect(source).not.toMatch(/\bADMIN_OVERRIDE_STATUS\b/);
    expect(source).not.toMatch(/\bMARK_PAYMENT_PENDING\b/);
    expect(source).not.toMatch(/\bFINALIZE_PAYMENT_SUCCESS\b/);
    expect(source).not.toMatch(/\bADMIN_CREATE_BOOKING\b/);
    expect(source).not.toMatch(/\bADMIN_RECORD_OFFLINE_PAYMENT\b/);
    expect(source).toContain("CREATE_BOOKING_DRAFT");
  });

  it("draft route must call facade only", () => {
    const source = readFileSync(routePath, "utf8");
    expect(source).toContain("adminCreateBookingDraftFacade");
    expect(source).not.toMatch(/\bfinalizePaidBooking\b/);
    expect(source).not.toMatch(/\binitializePayment\b/);
    expect(source).not.toMatch(/\brunAssignmentAfterPayment\b/);
    expect(source).not.toMatch(/\bexecuteBookingCommand\b/);
  });

  it("does not expose POST /api/admin/bookings full create route", () => {
    const createRoute = path.join(process.cwd(), "src/app/api/admin/bookings/route.ts");
    const source = readFileSync(createRoute, "utf8");
    expect(source).toContain("export async function GET");
    expect(source).not.toContain("export async function POST");
  });
});
