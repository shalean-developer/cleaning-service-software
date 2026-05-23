import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MUTATION_ROUTE_RULES } from "@/tests/security/mutationRouteBoundaryManifest";

const root = process.cwd();

const FORBIDDEN_PATTERNS = [
  /\bADMIN_OVERRIDE_STATUS\b/,
  /\.update\(\s*\{[^}]*status:\s*["']confirmed["']/,
  /\bearningsRepository\b/,
  /\bcreateEarning\b/,
  /\bmarkPayoutReady\b/,
  /\brecurringGeneration\b/,
  /\brunRecurringGeneration\b/,
];

const ADMIN_ASSIST_MUTATION_ROUTES = [
  "admin/bookings/draft/route.ts",
  "admin/bookings/[bookingId]/pending-payment/route.ts",
  "admin/bookings/[bookingId]/payment-link/route.ts",
  "admin/bookings/[bookingId]/payment-link/copy/route.ts",
  "admin/bookings/[bookingId]/payment-request/send/route.ts",
  "admin/bookings/[bookingId]/offline-payment/route.ts",
];

const ASSIGNMENT_DISPATCH_IMPORT =
  /\brunPostPaymentAssignmentDispatch\b|\brunAssignmentAfterPayment\b|\bcreateDispatchOffer\b/;

describe("admin-assisted booking phase 6 safety (static)", () => {
  for (const routeFile of ADMIN_ASSIST_MUTATION_ROUTES) {
    it(`${routeFile} is registered in mutation boundary manifest`, () => {
      const registered = MUTATION_ROUTE_RULES.some((rule) => rule.routeFile === routeFile);
      expect(registered).toBe(true);
    });
  }

  for (const routeFile of ADMIN_ASSIST_MUTATION_ROUTES) {
    it(`${path.basename(routeFile)} avoids forbidden lifecycle and payout bypasses`, () => {
      const source = readFileSync(path.join(root, "src/app/api", routeFile), "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    });
  }

  it("admin assist API routes do not import assignment dispatch directly", () => {
    for (const routeFile of ADMIN_ASSIST_MUTATION_ROUTES) {
      const source = readFileSync(path.join(root, "src/app/api", routeFile), "utf8");
      expect(source).not.toMatch(ASSIGNMENT_DISPATCH_IMPORT);
    }
  });

  it("offline payment facade uses finalizePaidBooking only", () => {
    const source = readFileSync(
      path.join(root, "src/features/bookings/server/admin/adminRecordOfflinePaymentFacade.ts"),
      "utf8",
    );
    expect(source).toContain("finalizePaidBookingWithDeps");
    expect(source).not.toMatch(/\brunPostPaymentAssignmentDispatch\b/);
  });

  it("payment link facade does not set confirmed directly", () => {
    const source = readFileSync(
      path.join(root, "src/features/bookings/server/admin/adminGeneratePaymentLinkFacade.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/status:\s*["']confirmed["']/);
    expect(source).not.toMatch(/\bADMIN_OVERRIDE_STATUS\b/);
  });
});
