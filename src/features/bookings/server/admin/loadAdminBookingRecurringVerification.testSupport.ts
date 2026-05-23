import type { AdminBookingRecurringMaterializationStatus } from "./loadAdminBookingRecurringVerification";

/** Test-only export for materialization status resolution. */
export function resolveMaterializationStatusForTest(input: {
  recurringEnabled: boolean;
  bookingStatus: string;
  hasSeriesOrGroup: boolean;
}): AdminBookingRecurringMaterializationStatus {
  if (!input.recurringEnabled) return "not_applicable";
  if (input.bookingStatus === "draft" || input.bookingStatus === "pending_payment") {
    return "pending_payment";
  }
  if (!input.hasSeriesOrGroup) return "pending_materialization";
  return "succeeded";
}
