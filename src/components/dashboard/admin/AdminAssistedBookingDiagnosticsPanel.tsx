import type { AdminAssistedBookingDiagnostics } from "@/features/bookings/server/admin/adminAssistedBookingDiagnosticsReadModel";

type Props = {
  diagnostics: AdminAssistedBookingDiagnostics;
};

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-100 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AdminAssistedBookingDiagnosticsPanel({ diagnostics }: Props) {
  const { counts, featureFlags, scan } = diagnostics;

  return (
    <section
      className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm"
      data-testid="admin-assisted-booking-diagnostics"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Admin-assisted booking diagnostics</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Read-only fleet view for rollout QA. Generated{" "}
            {new Date(diagnostics.generatedAt).toLocaleString("en-ZA")}.
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          Scanned {scan.bookingsScanned} bookings{scan.capped ? " (cap reached)" : ""}.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            featureFlags.bookingEnabled ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"
          }`}
        >
          ADMIN_ASSISTED_BOOKING_ENABLED: {featureFlags.bookingEnabled ? "ON" : "OFF"}
        </span>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            featureFlags.paymentLinksEnabled
              ? "bg-emerald-50 text-emerald-800"
              : "bg-zinc-100 text-zinc-700"
          }`}
        >
          PAYMENT_LINKS: {featureFlags.paymentLinksEnabled ? "ON" : "OFF"}
        </span>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            featureFlags.offlinePaymentsEnabled
              ? "bg-emerald-50 text-emerald-800"
              : "bg-zinc-100 text-zinc-700"
          }`}
        >
          OFFLINE_PAYMENTS: {featureFlags.offlinePaymentsEnabled ? "ON" : "OFF"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Admin-assisted drafts" value={counts.assistedDrafts} />
        <Metric label="Awaiting payment" value={counts.pendingPayment} />
        <Metric label="Payment links active" value={counts.paymentLinksActive} />
        <Metric label="Payment links expired" value={counts.paymentLinksExpired} />
        <Metric label="Offline payments recorded" value={counts.offlinePaymentsRecorded} />
        <Metric label="Offline payments finalized" value={counts.offlinePaymentsFinalized} />
        <Metric label="Offline payment failures" value={counts.offlinePaymentsFailed} />
        <Metric label="Confirmed after assist payment" value={counts.confirmedAfterAssistPayment} />
        <Metric label="Failed payment request emails" value={counts.failedPaymentRequestNotifications} />
        <Metric label="Assignment dispatch attention" value={counts.assignmentDispatchAttention} />
      </div>
    </section>
  );
}
