import Link from "next/link";
import type { AdminAssistedBookingDiagnostics } from "@/features/bookings/server/admin/adminAssistedBookingDiagnosticsReadModel";
import { AdminAssistedAssignmentRecoveryPanel } from "./AdminAssistedAssignmentRecoveryPanel";
import { AdminAssistedBookingAlertsPanel } from "./AdminAssistedBookingAlertsPanel";
import { AdminAssistedBookingDiagnosticsPanel } from "./AdminAssistedBookingDiagnosticsPanel";
import { AdminAssistedBookingTrainingAids } from "./AdminAssistedBookingTrainingAids";
import { AdminAssistedRolloutStageBadge } from "./AdminAssistedRolloutStageBadge";

type Props = {
  diagnostics: AdminAssistedBookingDiagnostics;
};

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-white p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function formatRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 1000) / 10}%`;
}

function formatHours(hours: number | null): string {
  if (hours == null) return "—";
  return `${hours}h`;
}

export function AdminAssistedBookingOperationsDashboard({ diagnostics }: Props) {
  const { analytics, counts, friction, operatorFeedbackCount, alerts, rolloutStage } = diagnostics;

  return (
    <div className="space-y-6" data-testid="admin-assisted-booking-operations-dashboard">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <AdminAssistedRolloutStageBadge stage={rolloutStage} />
      </section>

      <AdminAssistedBookingAlertsPanel alerts={alerts} />

      <AdminAssistedAssignmentRecoveryPanel
        assignmentDispatchAttention={counts.assignmentDispatchAttention}
        confirmedWithoutAssignmentDispatch={counts.confirmedWithoutAssignmentDispatch}
      />

      <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <p className="font-semibold text-amber-950">Internal pilot mode</p>
        <p className="mt-1 text-sm text-amber-900">
          Admin-assisted booking is in internal pilot. Use this dashboard for operator visibility only —
          no lifecycle mutations from this page.
        </p>
        <p className="mt-2 text-xs text-amber-800">
          Escalation: capture booking ID, payment reference, and last operator action from booking detail
          support summary. Feedback: note issues in your ops channel with{" "}
          <code className="rounded bg-amber-100 px-1">#admin-assist-pilot</code>.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/admin/operations/admin-assisted-pilot"
            className="text-sm font-medium text-amber-950 underline-offset-2 hover:underline"
          >
            Open pilot QA panel
          </Link>
          <Link
            href="/admin/bookings/create"
            className="text-sm font-medium text-amber-950 underline-offset-2 hover:underline"
          >
            Create assisted booking
          </Link>
        </div>
      </section>

      <AdminAssistedBookingTrainingAids compact />

      <AdminAssistedBookingDiagnosticsPanel diagnostics={diagnostics} />

      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        data-testid="admin-assisted-booking-analytics"
      >
        <h2 className="text-base font-semibold text-zinc-900">Payment request analytics</h2>
        <p className="mt-1 text-sm text-zinc-600">Read-only metrics from assist audit and notifications.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Links generated" value={analytics.linksGenerated} />
          <Metric label="Links regenerated" value={analytics.linksRegenerated} />
          <Metric label="Emails sent" value={analytics.emailsSent} />
          <Metric label="WhatsApp copied" value={analytics.whatsappCopied} />
          <Metric label="Expired links (audit)" value={analytics.expiredLinks} />
          <Metric label="Requests sent today" value={analytics.paymentRequestsSentToday} />
          <Metric
            label="Conversion (link → paid)"
            value={formatRate(analytics.conversionRateGeneratedToPaid)}
          />
          <Metric label="Avg draft → paid" value={formatHours(analytics.averageDraftToPaidHours)} />
          <Metric
            label="Avg pending → confirmed"
            value={formatHours(analytics.averagePendingToConfirmedHours)}
          />
          <Metric
            label="Stale pending (&gt;72h)"
            value={counts.stalePendingPayment}
            hint="Requires operator follow-up"
          />
          <Metric label="Awaiting payment" value={counts.awaitingPayment} />
        </div>
      </section>

      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        data-testid="admin-assisted-friction-summary"
      >
        <h2 className="text-base font-semibold text-zinc-900">Friction signals</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Pilot dry-runs" value={friction.pilotDryRunBookings} />
          <Metric label="Repeated regenerates" value={friction.repeatedLinkRegenerations} />
          <Metric label="Repeated email resends" value={friction.repeatedEmailResends} />
          <Metric label="Operator feedback" value={operatorFeedbackCount} />
          <Metric label="Abandoned drafts" value={friction.abandonedDrafts} />
          <Metric label="Missing customer email" value={friction.missingCustomerEmailBookings} />
        </div>
      </section>
    </div>
  );
}
