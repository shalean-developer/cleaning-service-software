/**
 * Internal pilot mode — booking mutations enabled but operators see pilot guidance.
 * Also enables dry-run metadata labeling on new drafts (see adminAssistedBookingDryRunFlag).
 * Set ADMIN_ASSISTED_BOOKING_PILOT_MODE=true during internal rollout.
 */
export function isAdminAssistedBookingPilotMode(): boolean {
  const flag = process.env.ADMIN_ASSISTED_BOOKING_PILOT_MODE?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
