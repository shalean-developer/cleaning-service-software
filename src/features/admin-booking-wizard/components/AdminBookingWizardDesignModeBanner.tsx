import { ADMIN_BOOKING_WIZARD_PHASE_LABEL } from "../constants";

type Props = {
  featureEnabled: boolean;
};

export function AdminBookingWizardDesignModeBanner({ featureEnabled }: Props) {
  return (
    <div
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
      data-testid="admin-booking-design-mode-banner"
    >
      <p className="font-semibold">{ADMIN_BOOKING_WIZARD_PHASE_LABEL}</p>
      <p className="mt-1 text-amber-900/90">
        This wizard is a read-only shell. No bookings, payments, or lifecycle changes are created.
        Actions that would mutate production data are disabled.
      </p>
      {!featureEnabled ? (
        <p className="mt-2 text-xs font-medium text-amber-800">
          Feature flag <code className="rounded bg-amber-100/80 px-1">ADMIN_ASSISTED_BOOKING_ENABLED</code>{" "}
          is off. Booking creation remains disabled even after Phase 2 until this flag is enabled.
        </p>
      ) : null}
    </div>
  );
}
