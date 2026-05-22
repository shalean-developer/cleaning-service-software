import type { AdminAssignmentAnalyticsPage } from "@/features/assignments/server/assignmentAnalyticsReadModel";
import {
  formatApproximateLatencyMetricDisplay,
  formatLatencyMetricDisplay,
  type AssignmentLatencyMetricDto,
} from "@/features/assignments/server/assignmentLatencyDto";
import type { AssignmentLatencyApproximateMetricDto } from "@/features/assignments/server/assignmentLatencyTrends7d";
import type { AssignmentAnalyticsPath } from "@/features/assignments/server/resolveAssignmentAnalyticsPath";

type Props = {
  analytics: AdminAssignmentAnalyticsPage;
};

const PATH_LABELS: Record<AssignmentAnalyticsPath, string> = {
  selected: "Selected cleaner",
  best_available: "Best available",
  admin_manual: "Admin manual",
  unknown: "Unknown path",
};

const PRIMARY_PATHS: AssignmentAnalyticsPath[] = [
  "selected",
  "best_available",
  "admin_manual",
];

function formatPercent(value: number | null): string {
  if (value == null) return "-";
  return `${value}%`;
}

function formatDeltaPercent(value: number | null): string {
  if (value == null) return "-";
  const arrow = value > 0 ? "↑" : value < 0 ? "↓" : "→";
  return `${arrow} ${Math.abs(value)}% vs prior week`;
}

function formatDeltaPoints(value: number | null): string {
  if (value == null) return "-";
  const arrow = value > 0 ? "↑" : value < 0 ? "↓" : "→";
  return `${arrow} ${Math.abs(value)} pts vs prior week`;
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-600">{hint}</p> : null}
    </article>
  );
}

function LatencyApproximateMetricCard({
  label,
  metric,
  hint,
}: {
  label: string;
  metric: AssignmentLatencyApproximateMetricDto;
  hint?: string;
}) {
  const value = formatApproximateLatencyMetricDisplay(
    metric.approximateMedianMinutes,
    metric.status,
  );
  const sampleHint =
    metric.status === "ok"
      ? `n=${metric.sampleCount}`
      : metric.sampleCount > 0
        ? `n=${metric.sampleCount} (need ≥10)`
        : "n=0";

  return (
    <MetricCard
      label={label}
      value={value}
      hint={[sampleHint, hint].filter(Boolean).join(" · ")}
    />
  );
}

function LatencyMetricCard({
  label,
  metric,
  hint,
}: {
  label: string;
  metric: AssignmentLatencyMetricDto;
  hint?: string;
}) {
  const value = formatLatencyMetricDisplay(metric);
  const sampleHint =
    metric.status === "ok"
      ? `n=${metric.sampleSize}`
      : metric.sampleSize > 0
        ? `n=${metric.sampleSize} (need ≥10)`
        : "n=0";

  return (
    <MetricCard
      label={label}
      value={value}
      hint={[sampleHint, hint].filter(Boolean).join(" · ")}
    />
  );
}

function PathStatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="font-medium tabular-nums text-zinc-900">{value}</dd>
    </div>
  );
}

function PathBreakdownCard({
  pathKey,
  created,
  accepted,
  acceptRateLabel,
}: {
  pathKey: AssignmentAnalyticsPath;
  created: number;
  accepted: number;
  acceptRateLabel: string;
}) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-3">
      <p className="text-xs font-medium text-zinc-500">{PATH_LABELS[pathKey]}</p>
      <dl className="mt-2 space-y-1 text-sm text-zinc-800">
        <PathStatRow label="Offers sent" value={created} />
        <PathStatRow label="Offers accepted" value={accepted} />
        <PathStatRow label="Accept rate" value={acceptRateLabel} />
      </dl>
    </article>
  );
}

export function AdminAssignmentAnalyticsPanel({ analytics }: Props) {
  const { live24h, trends7d, latencyTrends7d } = analytics;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Assignment funnel (24h live)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Aggregated from assignment offers and booking audit events. Read-only. does not change
          assignment behavior. Open offers are excluded from accept rate.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Offers sent" value={live24h.offersCreated} />
          <MetricCard label="Offers accepted" value={live24h.offersAccepted} />
          <MetricCard
            label="Accept rate"
            value={formatPercent(live24h.acceptRatePercent)}
            hint={`${live24h.terminalOffers} terminal offers`}
          />
          <MetricCard label="Decline rate" value={formatPercent(live24h.declineRatePercent)} />
          <MetricCard label="Expire rate" value={formatPercent(live24h.expireRatePercent)} />
          <MetricCard label="Bookings assigned" value={live24h.bookingsAssigned} />
          <MetricCard label="Redispatch bookings" value={live24h.redispatchBookings} />
          <MetricCard
            label="Max attempts hit"
            value={live24h.maxAttemptsBookings}
            hint="Bookings reaching 5 offer rows"
          />
          <MetricCard label="Admin interventions" value={live24h.adminInterventions} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Assignment latency (24h live)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Median durations from booking and offer timestamps in the rolling 24h window. Open and
          expired offers are excluded from cleaner response time. Figures are global. not split by
          assignment path.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LatencyMetricCard
            label="Median time to first offer"
            metric={live24h.latency24h.timeToFirstOffer}
            hint="From entering assignment to first offer sent"
          />
          <LatencyMetricCard
            label="Median cleaner response"
            metric={live24h.latency24h.cleanerResponseTime}
            hint="Accepted and declined offers only"
          />
          <LatencyMetricCard
            label="Median time to assigned"
            metric={live24h.latency24h.timeToAssigned}
            hint="From entering assignment to booking assigned"
          />
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Exact medians from the rolling 24h window. Manual dispatch and multi-offer bookings are
          included in global figures.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Assignment latency (7d rollup)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Approximate median from hourly duration histograms on assignment_metrics_hourly. Values
          use bucket midpoints. not exact medians. Run the rollup cron or a 168h backfill after
          deploying histogram columns.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LatencyApproximateMetricCard
            label="7d median time to first offer"
            metric={latencyTrends7d.timeToFirstOffer}
            hint="From entering assignment to first offer sent"
          />
          <LatencyApproximateMetricCard
            label="7d median cleaner response"
            metric={latencyTrends7d.cleanerResponse}
            hint="Accepted and declined offers only"
          />
          <LatencyApproximateMetricCard
            label="7d median time to assigned"
            metric={latencyTrends7d.timeToAssigned}
            hint="From entering assignment to booking assigned"
          />
        </div>

        {latencyTrends7d.partialCoverageNote ? (
          <p className="mt-3 text-xs text-amber-800">{latencyTrends7d.partialCoverageNote}</p>
        ) : null}

        <p className="mt-3 text-xs text-zinc-500">
          Path-specific latency deferred. Figures are global. not split by assignment path.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Assignment path breakdown (24h live)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Path is derived from current booking metadata; historical path accuracy improves in a later
          snapshot stage.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRIMARY_PATHS.map((pathKey) => {
            const path = live24h.byPath[pathKey];
            return (
              <PathBreakdownCard
                key={pathKey}
                pathKey={pathKey}
                created={path.offersCreated}
                accepted={path.offersAccepted}
                acceptRateLabel={path.acceptRateLabel}
              />
            );
          })}
          {live24h.byPath.unknown.offersCreated > 0 || live24h.byPath.unknown.offersAccepted > 0 ? (
            <PathBreakdownCard
              pathKey="unknown"
              created={live24h.byPath.unknown.offersCreated}
              accepted={live24h.byPath.unknown.offersAccepted}
              acceptRateLabel={live24h.byPath.unknown.acceptRateLabel}
            />
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">7-day trends (hourly rollups)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          From assignment_metrics_hourly buckets. Run the rollup cron for complete coverage.
        </p>

        <ul className="mt-4 space-y-2 text-sm text-zinc-800">
          <li>
            <span className="font-medium">Offers sent (7d):</span> {trends7d.offersCreated7d} ·{" "}
            {formatDeltaPercent(trends7d.offersCreated7dDeltaPercent)}
          </li>
          <li>
            <span className="font-medium">Accept rate (7d):</span>{" "}
            {formatPercent(trends7d.acceptRate7dPercent)} ·{" "}
            {formatDeltaPoints(trends7d.acceptRate7dDeltaPoints)}
          </li>
          <li>
            <span className="font-medium">Bookings assigned (7d):</span>{" "}
            {trends7d.bookingsAssigned7d}
          </li>
          <li>
            <span className="font-medium">Redispatch bookings (7d):</span>{" "}
            {trends7d.redispatchBookings7d}
          </li>
          <li>
            <span className="font-medium">Max attempts hit (7d):</span>{" "}
            {trends7d.maxAttemptsBookings7d}
          </li>
        </ul>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          By assignment path (7d)
        </h3>
        <ul className="mt-2 space-y-2 text-sm text-zinc-800">
          {PRIMARY_PATHS.map((pathKey) => {
            const path = trends7d.byPath7d[pathKey];
            return (
              <li key={pathKey}>
                <span className="font-medium">{PATH_LABELS[pathKey]}:</span> {path.offersCreated7d}{" "}
                sent · {path.offersAccepted7d} accepted · accept rate {path.acceptRate7dLabel}
              </li>
            );
          })}
          {trends7d.byPath7d.unknown.offersCreated7d > 0 ||
          trends7d.byPath7d.unknown.offersAccepted7d > 0 ? (
            <li>
              <span className="font-medium">{PATH_LABELS.unknown}:</span>{" "}
              {trends7d.byPath7d.unknown.offersCreated7d} sent ·{" "}
              {trends7d.byPath7d.unknown.offersAccepted7d} accepted · counts only (path could not be
              resolved from metadata)
            </li>
          ) : null}
        </ul>

        {trends7d.rollupAsOf ? (
          <p className="mt-3 text-xs text-zinc-500">
            Rollups as of {new Date(trends7d.rollupAsOf).toLocaleString("en-ZA")} UTC (
            {trends7d.coverageHours7d} buckets in window).
          </p>
        ) : null}
        {trends7d.partialCoverageNote ? (
          <p className="mt-2 text-xs text-amber-800">{trends7d.partialCoverageNote}</p>
        ) : null}
      </section>

      <p className="text-xs text-zinc-500">
        No customer or cleaner identities are shown. Operational queue counts on the admin home
        page remain separate (Stage 7A).
      </p>
    </div>
  );
}
