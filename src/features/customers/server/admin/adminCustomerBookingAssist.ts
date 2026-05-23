import { isAdminAssistedBookingEnabled } from "@/lib/app/adminAssistedBookingFlag";

/** Draft creation is available when the server feature flag is enabled. */
export function isAdminAssistedBookingDraftEnabled(): boolean {
  return isAdminAssistedBookingEnabled();
}

export const ADMIN_CUSTOMER_ASSISTED_BOOKING_LABEL = "Create draft booking";

export const ADMIN_CUSTOMER_ASSISTED_BOOKING_DEFERRED_MESSAGE =
  "Enable ADMIN_ASSISTED_BOOKING_ENABLED to create draft bookings for customers.";

export const ADMIN_CUSTOMER_ASSISTED_BOOKING_PREVIEW_HELPER =
  "Preview mode only until admin-assisted booking is enabled.";

/** @deprecated Use isAdminAssistedBookingDraftEnabled() */
export const ADMIN_CUSTOMER_ASSISTED_BOOKING_SUPPORTED = false;

export function buildAdminBookingCreateHref(customerId?: string | null): string {
  if (customerId?.trim()) {
    return `/admin/bookings/create?customerId=${encodeURIComponent(customerId.trim())}`;
  }
  return "/admin/bookings/create";
}
