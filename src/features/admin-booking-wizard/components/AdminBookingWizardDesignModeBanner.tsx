type Props = {
  featureEnabled: boolean;
};

export const ADMIN_BOOKING_WIZARD_PREVIEW_MODE_LABEL = "Admin-assisted booking preview mode";

export function AdminBookingWizardDesignModeBanner({ featureEnabled }: Props) {
  if (featureEnabled) {
    return null;
  }

  return (
    <div
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
      data-testid="admin-booking-design-mode-banner"
    >
      <p className="font-semibold">{ADMIN_BOOKING_WIZARD_PREVIEW_MODE_LABEL}</p>
      <p className="mt-1 text-amber-900/90">
        Admin-assisted booking preview mode. Draft and payment actions are disabled until the feature
        flag is enabled. You can browse all wizard steps safely; mutations remain blocked server-side.
      </p>
      <p className="mt-2 text-xs font-medium text-amber-800">
        Enable{" "}
        <code className="rounded bg-amber-100/80 px-1">ADMIN_ASSISTED_BOOKING_ENABLED</code> after
        rollout sign-off to save drafts and use payment rails.
      </p>
    </div>
  );
}
