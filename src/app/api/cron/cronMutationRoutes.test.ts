import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectPostRoutes } from "@/tests/security/staticGuardSupport";

/** Cron POST mutation routes (intentional; also expose GET for manual invoke). */
const ALLOWED_CRON_POST_ROUTES = new Set([
  "dispatch-deferred-assignments/route.ts",
  "expire-assignment-offers/route.ts",
  "expire-pending-payments/route.ts",
  "generate-recurring-occurrences/route.ts",
  "recover-assignment-after-payment/route.ts",
  "process-notification-outbox/route.ts",
  "rollup-assignment-metrics/route.ts",
  "rollup-notification-metrics/route.ts",
  "cleanup-notification-retention/route.ts",
  "reconcile-zoho-invoice-payments/route.ts",
  "sync-shalean-sales-to-zoho/route.ts",
  "sync-zoho-refunds-credits/route.ts",
]);

describe("cron mutation API routes", () => {
  it("only exposes intentional cron POST mutation routes", () => {
    const cronApiDir = path.join(process.cwd(), "src/app/api/cron");
    const postRoutes = collectPostRoutes(cronApiDir);

    expect(postRoutes.sort()).toEqual([...ALLOWED_CRON_POST_ROUTES].sort());
  });
});
