import Link from "next/link";
import type { AdminAssistedPilotQaPanel } from "@/features/bookings/server/admin/loadAdminAssistedPilotQaPanel";
import { AdminAssistedBookingDiagnosticsPanel } from "./AdminAssistedBookingDiagnosticsPanel";
import { AdminAssistedBookingTrainingAids } from "./AdminAssistedBookingTrainingAids";

type Props = {
  panel: AdminAssistedPilotQaPanel;
};

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-white p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

function flagLabel(flag: string): string {
  return flag.replace(/_/g, " ");
}

export function AdminAssistedPilotQaDashboard({ panel }: Props) {
  const { friction, diagnostics, flaggedBookings, dryRunBookings, recentFeedback } = panel;

  return (
    <div className="space-y-6" data-testid="admin-assisted-pilot-qa-dashboard">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Real operator QA panel</h2>
          <p className="text-sm text-zinc-600">
            Dry-runs, friction signals, and feedback for internal pilot review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            href="/api/admin/bookings/assist-pilot/export?format=csv"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-800 hover:bg-zinc-50"
            data-testid="admin-assisted-pilot-export-csv"
          >
            Export CSV
          </a>
          <a
            href="/api/admin/bookings/assist-pilot/export?format=json"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-800 hover:bg-zinc-50"
            data-testid="admin-assisted-pilot-export-json"
          >
            Export JSON
          </a>
        </div>
      </section>

      <AdminAssistedBookingTrainingAids />

      <AdminAssistedBookingDiagnosticsPanel diagnostics={diagnostics} />

      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        data-testid="admin-assisted-friction-metrics"
      >
        <h3 className="text-base font-semibold text-zinc-900">Friction tracking</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Pilot / dry-run bookings" value={friction.pilotDryRunBookings} />
          <Metric label="Repeated link regenerations" value={friction.repeatedLinkRegenerations} />
          <Metric label="Repeated email resends" value={friction.repeatedEmailResends} />
          <Metric label="Stale pending payments" value={friction.longPendingPaymentBookings} />
          <Metric label="Failed notification bookings" value={friction.multipleFailedNotificationBookings} />
          <Metric label="Offline payment used" value={friction.offlinePaymentOverrides} />
          <Metric label="Abandoned drafts" value={friction.abandonedDrafts} />
          <Metric label="Missing customer email" value={friction.missingCustomerEmailBookings} />
          <Metric label="Operator feedback entries" value={panel.feedbackCount} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Flagged bookings</h3>
        {flaggedBookings.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No friction flags in the current scan window.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {flaggedBookings.map((booking) => (
              <li
                key={booking.bookingId}
                className="rounded-lg border border-zinc-100 px-3 py-2 text-sm"
                data-testid="admin-assisted-flagged-booking"
              >
                <Link
                  href={`/admin/bookings/${booking.bookingId}`}
                  className="font-medium text-sky-700 underline-offset-2 hover:underline"
                >
                  {booking.customerLabel}
                </Link>
                <span className="ml-2 text-xs text-zinc-500">{booking.status}</span>
                <p className="mt-1 text-xs text-zinc-600">{booking.flags.map(flagLabel).join(" · ")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
        <h3 className="text-base font-semibold text-violet-950">Dry-run bookings</h3>
        {dryRunBookings.length === 0 ? (
          <p className="mt-2 text-sm text-violet-900/80">No pilot dry-run labels in scan window.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {dryRunBookings.map((booking) => (
              <li key={booking.bookingId}>
                <Link
                  href={`/admin/bookings/${booking.bookingId}`}
                  className="font-medium text-violet-900 underline-offset-2 hover:underline"
                >
                  {booking.customerLabel}
                </Link>
                <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                  Pilot / Dry-run
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Recent operator feedback</h3>
        {recentFeedback.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No feedback submitted yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recentFeedback.map((fb) => (
              <li key={fb.id} className="rounded-lg border border-zinc-100 px-3 py-2 text-sm">
                <Link
                  href={`/admin/bookings/${fb.bookingId}`}
                  className="font-medium text-sky-700 underline-offset-2 hover:underline"
                >
                  Booking {fb.bookingId.slice(0, 8)}
                </Link>
                {fb.confusingText ? <p className="mt-1 text-zinc-700">Confusing: {fb.confusingText}</p> : null}
                {fb.slowedDownText ? (
                  <p className="mt-1 text-zinc-700">Slowed down: {fb.slowedDownText}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
