import Link from "next/link";
import type { AdminAssistedProductionStatus } from "@/features/bookings/server/admin/loadAdminAssistedProductionStatus";
import { AdminAssistedBookingAlertsPanel } from "./AdminAssistedBookingAlertsPanel";
import { AdminAssistedRolloutStageBadge } from "./AdminAssistedRolloutStageBadge";

import type { AdminAssistedProductionLearning } from "@/features/bookings/server/admin/loadAdminAssistedProductionLearning";
import { AdminAssistedProductionLearningSection } from "./AdminAssistedProductionLearningSection";

type Props = {
  status: AdminAssistedProductionStatus;
  learning: AdminAssistedProductionLearning;
};

const HEALTH_BAND_STYLES: Record<
  AdminAssistedProductionStatus["health"]["band"],
  string
> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  degraded: "border-orange-200 bg-orange-50 text-orange-950",
  critical: "border-red-200 bg-red-50 text-red-950",
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-white p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

function RecentEvents({
  title,
  events,
  testId,
}: {
  title: string;
  events: AdminAssistedProductionStatus["recentPaymentConfirmations"];
  testId: string;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm" data-testid={testId}>
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">None in the current scan window.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {events.map((event) => (
            <li key={event.id} className="rounded-lg border border-zinc-100 px-3 py-2">
              {event.bookingId ? (
                <Link
                  href={`/admin/bookings/${event.bookingId}`}
                  className="font-medium text-sky-700 underline-offset-2 hover:underline"
                >
                  {event.customerLabel ?? event.bookingId.slice(0, 8)}
                </Link>
              ) : (
                <span className="font-medium">{event.title}</span>
              )}
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase">
                {event.severity}
              </span>
              <p className="mt-1 text-xs text-zinc-600">{event.title}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminAssistedProductionDashboard({ status, learning }: Props) {
  const { diagnostics, health, liveMetrics, readiness, alertCountsBySeverity, activeIncidents } =
    status;

  return (
    <div className="space-y-6" data-testid="admin-assisted-production-dashboard">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">
            Last updated {new Date(status.generatedAt).toLocaleString("en-ZA")}
          </p>
          <h2 className="text-lg font-semibold text-zinc-900">Live production status</h2>
          <p className="text-sm text-zinc-600">{health.operatorAttentionSummary}</p>
        </div>
        <AdminAssistedRolloutStageBadge stage={diagnostics.rolloutStage} />
      </section>

      <section
        className={`rounded-xl border p-4 ${HEALTH_BAND_STYLES[health.band]}`}
        data-testid="admin-assisted-rollout-health"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">Rollout health</p>
            <p className="text-3xl font-bold tabular-nums">{health.score}/100</p>
            <p className="text-sm capitalize">{health.band}</p>
          </div>
          <div className="text-right text-xs">
            <p>Critical alerts: {alertCountsBySeverity.critical}</p>
            <p>High: {alertCountsBySeverity.high}</p>
            <p>Warning: {alertCountsBySeverity.warning}</p>
            <p>Info: {alertCountsBySeverity.info}</p>
          </div>
        </div>
      </section>

      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        data-testid="admin-assisted-live-metrics"
      >
        <h3 className="text-base font-semibold text-zinc-900">Live metrics</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Active assisted bookings" value={liveMetrics.activeAssistedBookings} />
          <Metric label="Pending payments" value={liveMetrics.pendingPayments} />
          <Metric label="Confirmed today" value={liveMetrics.confirmedToday} />
          <Metric label="Offline EFT today" value={liveMetrics.offlineEftToday} />
          <Metric label="Failed payment requests" value={liveMetrics.failedPaymentRequests} />
          <Metric label="Recurring failures" value={liveMetrics.recurringMaterializationFailures} />
          <Metric label="Orphan confirmed" value={liveMetrics.orphanConfirmedBookings} />
          <Metric label="Assignment dispatch failures" value={liveMetrics.assignmentDispatchFailures} />
          <Metric label="Stale pending &gt;72h" value={liveMetrics.stalePendingOver72h} />
          <Metric label="Checklist progress" value={`${readiness.checklistProgress.percent}%`} />
        </div>
      </section>

      <AdminAssistedBookingAlertsPanel alerts={status.unresolvedAlerts} />

      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        data-testid="admin-assisted-active-incidents"
      >
        <h3 className="text-base font-semibold text-zinc-900">Active incidents</h3>
        <p className="mt-1 text-sm text-zinc-600">Read-only — no automatic resolution.</p>
        {activeIncidents.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-800">No active incidents in scan window.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {activeIncidents.slice(0, 20).map((incident) => (
              <li
                key={incident.id}
                className="rounded-lg border border-zinc-100 p-3 text-sm"
                data-testid={`admin-assisted-incident-${incident.category}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/bookings/${incident.bookingId}`}
                    className="font-medium text-sky-700 underline-offset-2 hover:underline"
                  >
                    {incident.customerLabel}
                  </Link>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {incident.severity}
                  </span>
                  <span className="text-xs text-zinc-500">{incident.category.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-1 font-medium">{incident.title}</p>
                <p className="mt-1 text-xs text-zinc-600">{incident.guidance}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  <span className="font-medium">Escalation:</span> {incident.escalation}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentEvents
          title="Recent payment confirmations"
          events={status.recentPaymentConfirmations}
          testId="admin-assisted-recent-confirmations"
        />
        <RecentEvents
          title="Recent offline recordings"
          events={status.recentOfflineRecordings}
          testId="admin-assisted-recent-offline"
        />
        <RecentEvents
          title="Recent failed notifications"
          events={status.recentFailedNotifications}
          testId="admin-assisted-recent-failed-notifications"
        />
        <RecentEvents
          title="Recent assignment escalations"
          events={status.recentAssignmentEscalations}
          testId="admin-assisted-recent-assignment"
        />
      </div>

      <section
        className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm"
        data-testid="admin-assisted-observability-metrics"
      >
        <h3 className="font-semibold text-zinc-900">Performance observability</h3>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-500">Assist-summary cache hit rate</dt>
            <dd>
              {status.observability.assistSummaryCacheHitRate != null
                ? `${status.observability.assistSummaryCacheHitRate}%`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Production load duration</dt>
            <dd>
              {status.observability.productionLoadDurationMs != null
                ? `${status.observability.productionLoadDurationMs}ms`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Recurring enrichment</dt>
            <dd>
              {status.observability.recurringEnrichmentDurationMs != null
                ? `${status.observability.recurringEnrichmentDurationMs}ms`
                : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/api/admin/bookings/assist-production/weekly-export?format=csv"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
            data-testid="admin-assisted-weekly-export-csv"
          >
            Weekly CSV export
          </a>
          <a
            href="/api/admin/bookings/assist-production/weekly-export?format=json"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
            data-testid="admin-assisted-weekly-export-json"
          >
            Weekly JSON export
          </a>
        </div>
      </section>

      <AdminAssistedProductionLearningSection learning={learning} />
    </div>
  );
}
