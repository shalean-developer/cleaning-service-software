import { isAdminAssistedBookingEnabled } from "./adminAssistedBookingFlag";

/**
 * Admin-generated Paystack payment links for admin-assisted bookings.
 * Requires ADMIN_ASSISTED_BOOKING_ENABLED=true as well.
 */
export function isAdminAssistedPaymentLinksEnabled(): boolean {
  const flag = process.env.ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function isAdminAssistedPaymentLinksActive(): boolean {
  return isAdminAssistedBookingEnabled() && isAdminAssistedPaymentLinksEnabled();
}
