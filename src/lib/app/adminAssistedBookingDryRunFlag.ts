/**
 * When true, new admin-assisted drafts are labeled as pilot/dry-run in booking metadata.
 * Real lifecycle and payment flows still apply — labeling only.
 *
 * Enabled when either:
 * - `ADMIN_ASSISTED_BOOKING_DRY_RUN_LABEL=true`, or
 * - `ADMIN_ASSISTED_BOOKING_PILOT_MODE=true` (pilot mode auto-enables dry-run labeling).
 */
export function isAdminAssistedBookingDryRunLabelingEnabled(): boolean {
  const explicit = process.env.ADMIN_ASSISTED_BOOKING_DRY_RUN_LABEL?.trim().toLowerCase();
  if (explicit === "true" || explicit === "1" || explicit === "yes") return true;
  if (explicit === "false" || explicit === "0" || explicit === "no") return false;

  const pilot = process.env.ADMIN_ASSISTED_BOOKING_PILOT_MODE?.trim().toLowerCase();
  return pilot === "true" || pilot === "1" || pilot === "yes";
}
