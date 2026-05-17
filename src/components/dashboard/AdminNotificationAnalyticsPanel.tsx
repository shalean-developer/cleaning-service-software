import type { AdminNotificationAnalytics } from "@/features/notifications/server/notificationAdminTypes";

type Props = {
  analytics: AdminNotificationAnalytics;
};

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

function formatDeltaPercent(value: number | null): string {
  if (value == null) return "—";
  const arrow = value > 0 ? "↑" : value < 0 ? "↓" : "→";
  return `${arrow} ${Math.abs(value)}% vs prior week`;
}

function formatDeltaPoints(value: number | null): string {
  if (value == null) return "—";
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
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-600">{hint}</p> : null}
    </article>
  );
}

function pressureTone(level: AdminNotificationAnalytics["queuePressure"]["level"]): string {
  switch (level) {
    case "critical":
      return "border-red-300 bg-red-50 text-red-950";
    case "elevated":
      return "border-amber-300 bg-amber-50 text-amber-950";
    default:
      return "border-emerald-300 bg-emerald-50 text-emerald-950";
  }
}

export function AdminNotificationAnalyticsPanel({ analytics }: Props) {
  const { worker24h, trends7d, queuePressure, dryRunModeActive } = analytics;

  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/80 p-5">
      <h2 className="text-sm font-semibold text-zinc-900">Delivery analytics (24h)</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Aggregated from worker runs. Queue cards below show current outbox state.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${pressureTone(queuePressure.level)}`}
        >
          {queuePressure.label} · score {queuePressure.score}
        </span>
        {dryRunModeActive ? (
          <span className="rounded-full border border-sky-400 bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-900">
            Dry-run mode active
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <MetricCard label="Worker runs (24h)" value={worker24h.runCount} />
        <MetricCard
          label="Runs OK"
          value={formatPercent(worker24h.runsOkPercent)}
          hint="Route completed without error"
        />
        <MetricCard label="Sent (24h)" value={worker24h.sentTotal} hint="All provider modes" />
        <MetricCard
          label="Failed (24h)"
          value={worker24h.failedTotal}
          hint="Row failures in batches"
        />
        <MetricCard label="Dry-run (24h)" value={worker24h.dryRunTotal} hint="Preview sends" />
        <MetricCard label="Scanned (24h)" value={worker24h.scannedTotal} />
        <MetricCard label="Avg sent / run" value={worker24h.avgSentPerRun ?? "—"} />
        <MetricCard
          label="Live success rate"
          value={formatPercent(worker24h.liveSuccessRatePercent)}
          hint="Resend only — excludes dry-run provider"
        />
        <MetricCard
          label="Dry-run share"
          value={formatPercent(worker24h.dryRunRatioPercent)}
          hint="Of sent + failed + dry-run in 24h"
        />
      </div>

      <div className="mt-6 border-t border-zinc-200 pt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
          7-day trends (hourly rollups)
        </h3>
        <p className="mt-1 text-xs text-zinc-600">
          Worker throughput only — compares last 7 days to the prior 7 days.
          {trends7d.rollupAsOf ? (
            <>
              {" "}
              Rollups through{" "}
              <time dateTime={trends7d.rollupAsOf}>
                {new Date(trends7d.rollupAsOf).toISOString().slice(0, 16).replace("T", " ")} UTC
              </time>
              .
            </>
          ) : null}
        </p>

        <ul className="mt-3 space-y-2 text-sm text-zinc-800">
          <li>
            <span className="font-medium">Sent (7d):</span> {trends7d.sent7dTotal}
            <span className="text-zinc-500"> — {formatDeltaPercent(trends7d.sent7dDeltaPercent)}</span>
          </li>
          <li>
            <span className="font-medium">Failed rows (7d):</span> {trends7d.failed7dTotal}
            <span className="text-zinc-500">
              {" "}
              — {formatDeltaPercent(trends7d.failed7dDeltaPercent)}
            </span>
          </li>
          <li>
            <span className="font-medium">Live success rate (7d):</span>{" "}
            {formatPercent(trends7d.liveSuccessRate7dPercent)}
            <span className="text-zinc-500">
              {" "}
              — {formatDeltaPoints(trends7d.liveSuccessRate7dDeltaPoints)}
            </span>
          </li>
          <li>
            <span className="font-medium">Dry-run deliveries (7d):</span> {trends7d.dryRun7dTotal}
            <span className="text-zinc-500"> — separate from live success rate</span>
          </li>
          <li>
            <span className="font-medium">Worker runs (7d):</span> {trends7d.runCount7dTotal}
            <span className="text-zinc-500">
              {" "}
              — {formatDeltaPercent(trends7d.runCount7dDeltaPercent)}
            </span>
          </li>
        </ul>

        {trends7d.partialCoverageNote ? (
          <p className="mt-3 text-xs text-amber-800">{trends7d.partialCoverageNote}</p>
        ) : null}
        {trends7d.rollupStale ? (
          <p className="mt-2 text-xs text-amber-800">
            Hourly rollup may be delayed — check the metrics rollup cron.
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Live success rate excludes dry-run provider runs. Unsupported templates are excluded from
        pressure score and failure rates.
      </p>
    </section>
  );
}
