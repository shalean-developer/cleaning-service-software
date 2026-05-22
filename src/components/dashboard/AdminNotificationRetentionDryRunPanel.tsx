import type { NotificationRetentionDryRunReport } from "@/features/notifications/server/notificationRetentionTypes";

type Props = {
  retention: NotificationRetentionDryRunReport;
};

function RetentionMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
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

function formatOldest(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "-";
  }
}

export function AdminNotificationRetentionDryRunPanel({ retention }: Props) {
  const { policy, eligible, protected: protectedCounts, oldestEligible } = retention;

  return (
    <section className="mt-6 rounded-xl border border-sky-200 bg-sky-50/60 p-5">
      <h2 className="text-sm font-semibold text-zinc-900">Retention dry-run</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Dry-run only. no data is deleted. Counts show rows that would be eligible for future
        cleanup under the Stage 5I policy (live sent {policy.outboxLiveSentDays}d, dry-run sent{" "}
        {policy.outboxDryRunSentDays}d, failed {policy.outboxFailedMaxDays}d, unsupported pending{" "}
        {policy.outboxUnsupportedPendingDays}d, worker runs {policy.workerRunsDays}d with rollup,
        hourly metrics {policy.metricsMonths}mo).
      </p>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Eligible (outbox)
        </h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RetentionMetricCard
            label="Live sent (older than policy)"
            value={eligible.outbox.liveSentOlderThanPolicy}
            hint={`Oldest ${formatOldest(oldestEligible.liveSent)}`}
          />
          <RetentionMetricCard
            label="Dry-run sent (older than policy)"
            value={eligible.outbox.dryRunSentOlderThanPolicy}
            hint={`Oldest ${formatOldest(oldestEligible.dryRunSent)}`}
          />
          <RetentionMetricCard
            label="Failed (past max retention)"
            value={eligible.outbox.failedOlderThanPolicy}
            hint={`Oldest ${formatOldest(oldestEligible.failedExpired)}`}
          />
          <RetentionMetricCard
            label="Unsupported pending (older than policy)"
            value={eligible.outbox.unsupportedPendingOlderThanPolicy}
            hint={`Oldest ${formatOldest(oldestEligible.unsupportedPending)}`}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <RetentionMetricCard
          label="Worker runs (rollup-covered)"
          value={eligible.workerRuns.eligibleWithRollupCoverage}
          hint={`${eligible.workerRuns.olderThanPolicy} older than ${policy.workerRunsDays}d · oldest ${formatOldest(oldestEligible.workerRuns)}`}
        />
        <RetentionMetricCard
          label="Hourly metrics (older than policy)"
          value={eligible.metricsHourly.olderThanPolicy}
          hint={`Oldest bucket ${formatOldest(oldestEligible.metricsHourly)}`}
        />
        <RetentionMetricCard
          label="Worker runs (missing rollup)"
          value={eligible.workerRuns.protectedMissingRollup}
          hint="Protected until hourly bucket exists"
        />
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Protected (outbox)
        </h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RetentionMetricCard
            label="Pending deliverable"
            value={protectedCounts.outbox.pendingDeliverable}
          />
          <RetentionMetricCard label="Processing" value={protectedCounts.outbox.processing} />
          <RetentionMetricCard
            label="Failed within retention"
            value={protectedCounts.outbox.failedWithinRetention}
          />
          <RetentionMetricCard
            label={`Recent requeue shield (${policy.requeueShieldDays}d)`}
            value={protectedCounts.outbox.requeueShieldRecent}
          />
        </div>
      </div>
    </section>
  );
}
