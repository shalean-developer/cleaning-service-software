import type { NotificationHealthSummary } from "@/features/notifications/server/notificationAdminTypes";

type Props = {
  summary: NotificationHealthSummary;
  oldestActionablePendingAgeMs: number | null;
};

function formatAge(ms: number | null): string {
  if (ms == null) return "None";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function Card({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "neutral" | "warning" | "danger" | "success" | "info";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50"
          : tone === "info"
            ? "border-sky-200 bg-sky-50"
            : "border-zinc-200 bg-white";

  return (
    <article className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-600">{hint}</p> : null}
    </article>
  );
}

export function AdminNotificationHealthCards({ summary, oldestActionablePendingAgeMs }: Props) {
  return (
    <section>
      <p className="text-sm text-zinc-600">
        Oldest actionable pending:{" "}
        <strong>{formatAge(oldestActionablePendingAgeMs)}</strong>
        <span className="text-zinc-500"> (deliverable, retry due)</span>
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Sent (deliverable)" value={summary.sent} tone="success" />
        <Card
          label="Pending (actionable)"
          value={summary.actionablePending}
          tone={summary.actionablePending > 0 ? "warning" : "neutral"}
          hint="Worker will pick up on next cron"
        />
        <Card label="Scheduled retry" value={summary.scheduledRetry} tone="info" />
        <Card label="Processing" value={summary.processing} />
        <Card
          label="Failed"
          value={summary.failed}
          tone={summary.failed > 0 ? "danger" : "neutral"}
        />
        <Card
          label="Stale processing"
          value={summary.staleProcessing}
          tone={summary.staleProcessing > 0 ? "danger" : "neutral"}
          hint="Older than reclaim threshold"
        />
        <Card
          label="Unsupported pending"
          value={summary.unsupportedPending}
          hint="Not delivered yet — not a failure"
        />
        <Card label="Dry-run rows" value={summary.dryRun} tone="info" hint="Metadata in last_error" />
      </div>
    </section>
  );
}
