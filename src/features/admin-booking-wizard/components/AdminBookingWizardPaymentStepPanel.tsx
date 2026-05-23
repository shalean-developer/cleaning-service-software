import {
  deriveAdminBookingFlowProgress,
  resolveAdminBookingFlowPhase,
  resolveAdminBookingFlowPhaseLabel,
  type AdminBookingFlowSnapshot,
} from "../adminBookingFlowState";

const LIFECYCLE_STEPS = [
  "Save draft",
  "Create unpaid booking",
  "Generate payment link or record offline payment",
  "Customer pays",
  "Booking confirms automatically",
  "Assignment begins after confirmation",
] as const;

type Props = {
  featureEnabled: boolean;
  paymentLinksEnabled: boolean;
  offlinePaymentsEnabled: boolean;
  flow: AdminBookingFlowSnapshot;
};

export function AdminBookingWizardPaymentStepPanel({
  featureEnabled,
  paymentLinksEnabled,
  offlinePaymentsEnabled,
  flow,
}: Props) {
  const phase = resolveAdminBookingFlowPhase(flow);
  const phaseLabel = resolveAdminBookingFlowPhaseLabel(phase);
  const progress = deriveAdminBookingFlowProgress(flow);

  return (
    <div className="space-y-4" data-testid="admin-booking-payment-step">
      <section className="rounded-lg border border-slate-200 bg-white px-3 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Payment lifecycle
        </h3>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-700">
          {LIFECYCLE_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section
        className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900"
        data-testid="admin-booking-payment-phase"
      >
        <p className="font-medium">Current state: {phaseLabel}</p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>Draft saved: {progress.draftSaved ? "Yes" : "Not yet"}</li>
          <li>Pending payment: {progress.pendingPaymentCreated ? "Yes" : "Not yet"}</li>
          <li>Payment link: {progress.paymentLinkGenerated ? "Generated" : "Not yet"}</li>
          {paymentLinksEnabled ? (
            <li>Email request: {progress.emailRequestSent ? "Sent" : "Not sent"}</li>
          ) : (
            <li>Payment links: Disabled in this environment</li>
          )}
          {offlinePaymentsEnabled ? (
            <li>
              Offline payment: Record from booking detail after pending payment is created
            </li>
          ) : null}
        </ul>
      </section>

      {!featureEnabled ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          data-testid="admin-booking-payment-preview-note"
        >
          Admin-assisted booking is in preview mode. Actions on the confirmation step remain disabled
          until the feature flag is enabled.
        </p>
      ) : (
        <p className="text-xs text-slate-600">
          Complete the review step, then use the confirmation step to save the draft and move through
          unpaid → payment link → customer notification. Finalize paid booking stays disabled here;
          Paystack webhooks confirm payment automatically.
        </p>
      )}
    </div>
  );
}
