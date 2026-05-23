import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** Intentional admin POST mutation routes. */
const ALLOWED_ADMIN_POST_ROUTES = new Set([
  "cleaners/route.ts",
  "customers/route.ts",
  "bookings/[bookingId]/payout-ready/route.ts",
  "bookings/[bookingId]/mark-paid-out/route.ts",
  "bookings/[bookingId]/offline-payment/route.ts",
  "bookings/[bookingId]/payment-link/copy/route.ts",
  "bookings/[bookingId]/payment-link/route.ts",
  "bookings/[bookingId]/payment-request/send/route.ts",
  "bookings/[bookingId]/pending-payment/route.ts",
  "bookings/[bookingId]/recover-assignment/route.ts",
  "bookings/[bookingId]/dispatch-deferred-assignment/route.ts",
  "bookings/[bookingId]/dispatch-offer/route.ts",
  "bookings/[bookingId]/dispatch-support-offer/route.ts",
  "bookings/[bookingId]/replace-open-offer/route.ts",
  "bookings/assist-incidents/review/route.ts",
  "bookings/draft/route.ts",
  "bookings/[bookingId]/archive/route.ts",
  "bookings/[bookingId]/assist-feedback/route.ts",
  "bookings/[bookingId]/hard-delete/route.ts",
  "customers/[customerId]/archive/route.ts",
  "cleaner-applications/[applicationId]/convert/route.ts",
  "booking-support-requests/[requestId]/status/route.ts",
  "booking-support-requests/[requestId]/execute-reschedule/route.ts",
  "recurring/groups/[groupId]/cancel/route.ts",
  "recurring/groups/[groupId]/pause/route.ts",
  "recurring/groups/[groupId]/resume/route.ts",
  "recurring/requests/[requestId]/resolve/route.ts",
  "cleaners/[cleanerId]/complete-onboarding/route.ts",
  "cleaners/[cleanerId]/deactivate/route.ts",
  "cleaners/[cleanerId]/suspend/route.ts",
  "cleaners/[cleanerId]/reactivate/route.ts",
  "cleaners/[cleanerId]/unsuspend/route.ts",
  "cleaners/[cleanerId]/archive/route.ts",
  "notifications/[outboxId]/requeue/route.ts",
  "production-rollout/checklist/[key]/route.ts",
  "recurring/[seriesId]/pause/route.ts",
  "recurring/[seriesId]/resume/route.ts",
  "recurring/[seriesId]/cancel/route.ts",
  "recurring/[seriesId]/skip-next/route.ts",
  "recurring/[seriesId]/reschedule-next/route.ts",
  "zoho-invoice-payments/charge-saved-card/route.ts",
  "zoho-invoice-payments/payment-methods/[paymentMethodId]/revoke/route.ts",
  "zoho-sales-sync/register-refund-credit/route.ts",
  "monthly-billing/accounts/[customerId]/enable/route.ts",
  "monthly-billing/accounts/[customerId]/disable/route.ts",
  "monthly-billing/accounts/[customerId]/terms/route.ts",
  "monthly-billing/accounts/[customerId]/zoho-customer/route.ts",
  "monthly-billing/bookings/[bookingId]/authorize-service/route.ts",
]);

function collectRouteFiles(dir: string, prefix = ""): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const name of entries) {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) {
      files.push(...collectRouteFiles(full, rel));
    } else if (name === "route.ts") {
      files.push(rel);
    }
  }
  return files;
}

describe("admin API routes", () => {
  it("only exposes intentional admin POST mutation routes", () => {
    const adminApiDir = path.join(process.cwd(), "src/app/api/admin");
    const routeFiles = collectRouteFiles(adminApiDir);
    const postRoutes: string[] = [];

    for (const rel of routeFiles) {
      const content = readFileSync(path.join(adminApiDir, rel), "utf8");
      if (/export\s+async\s+function\s+POST/.test(content)) {
        postRoutes.push(rel.replace(/\\/g, "/"));
      }
    }

    expect(postRoutes.sort()).toEqual([...ALLOWED_ADMIN_POST_ROUTES].sort());
  });
});
