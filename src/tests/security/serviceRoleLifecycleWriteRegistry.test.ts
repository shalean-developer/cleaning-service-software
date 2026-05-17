import { describe, expect, it } from "vitest";
import { collectServiceRoleImporterPaths } from "./staticGuardSupport";

/**
 * Modules allowed to import `@/lib/supabase/serviceRole` for server-side lifecycle work.
 * Add a path here only after review — see docs/security/command-boundary-static-guards.md
 */
export const ALLOWED_SERVICE_ROLE_LIFECYCLE_IMPORTERS = new Set([
  "lib/supabase/serviceRole.ts",
  "features/bookings/server/commands/runBookingCommand.ts",
  "features/payments/server/finalizePaidBooking.ts",
  "features/payments/server/processPaystackChargeFailure.ts",
  "features/payments/server/upsertBookingFromPaystack.ts",
  "features/payments/server/initializePayment.ts",
  "features/payments/server/verifyPayment.ts",
  "features/bookings/server/lock/createBookingPaymentLock.ts",
  "features/bookings/server/lock/createPaymentRetryLock.ts",
  "features/bookings/server/lock/assertActiveLock.ts",
  "features/bookings/server/lock/validateCleanerPreference.ts",
  "features/cleaners/server/getAvailableCleaners.ts",
  "features/assignments/server/adminManualDispatchOffer.ts",
  "features/assignments/server/adminAssignmentRecovery.ts",
  "features/assignments/server/adminReplaceOpenOffer.ts",
  "app/api/cron/expire-assignment-offers/route.ts",
  "app/api/cron/expire-pending-payments/route.ts",
  "app/api/cron/recover-assignment-after-payment/route.ts",
  "app/api/cron/process-notification-outbox/route.ts",
  "features/notifications/server/processNotificationOutbox.ts",
  "features/notifications/server/resolveCustomerEmail.ts",
  "scripts/recoverAssignmentAfterPayment.ts",
  "scripts/repairOrphanedAssignments.ts",
]);

describe("service role lifecycle write registry (static)", () => {
  it("only approved modules import the service role client", () => {
    const importers = collectServiceRoleImporterPaths();
    const unexpected = importers.filter((p) => !ALLOWED_SERVICE_ROLE_LIFECYCLE_IMPORTERS.has(p));

    expect(
      unexpected,
      `New service-role import(s) detected. Add to ALLOWED_SERVICE_ROLE_LIFECYCLE_IMPORTERS after review:\n${unexpected.join("\n")}`,
    ).toEqual([]);
  });

  it("registry entries still exist on disk", () => {
    const importers = new Set(collectServiceRoleImporterPaths());
    const missingFromCodebase = [...ALLOWED_SERVICE_ROLE_LIFECYCLE_IMPORTERS].filter(
      (p) => p !== "lib/supabase/serviceRole.ts" && !importers.has(p),
    );

    expect(
      missingFromCodebase,
      "Stale registry entries (file no longer imports service role):",
    ).toEqual([]);
  });
});
