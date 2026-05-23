/**
 * Admin-assisted booking (create on behalf of customer).
 * Off by default until later rollout phases enable mutations.
 *
 * Set ADMIN_ASSISTED_BOOKING_ENABLED=true (or 1 / yes) after Phase 2+ sign-off.
 */
export function isAdminAssistedBookingEnabled(): boolean {
  const flag = process.env.ADMIN_ASSISTED_BOOKING_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
