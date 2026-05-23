import { isAdminAssistedBookingEnabled } from "./adminAssistedBookingFlag";

/**
 * Admin offline payment recording (EFT / cash / card machine) for admin-assisted bookings.
 * Requires ADMIN_ASSISTED_BOOKING_ENABLED=true as well.
 */
export function isAdminAssistedOfflinePaymentsEnabled(): boolean {
  const flag = process.env.ADMIN_ASSISTED_OFFLINE_PAYMENTS_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function isAdminAssistedOfflinePaymentsActive(): boolean {
  return isAdminAssistedBookingEnabled() && isAdminAssistedOfflinePaymentsEnabled();
}
