import type { AdminNotificationWorkerHealthModel } from "@/features/notifications/server/notificationWorkerRunTypes";

type Props = {
  workerHealth: AdminNotificationWorkerHealthModel;
};

function formatCompletedAt(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function healthTone(level: AdminNotificationWorkerHealthModel["healthLevel"]): string {
  switch (level) {
    case "healthy":
      return "border-emerald-300 bg-emerald-50/90 text-emerald-950";
    case "warning":
      return "border-amber-400 bg-amber-50 text-amber-950";
    case "critical":
      return "border-red-400 bg-red-50 text-red-950";
    default:
      return "border-zinc-300 bg-zinc-100/90 text-zinc-900";
  }
}

function healthBadgeClass(level: AdminNotificationWorkerHealthModel["healthLevel"]): string {
  switch (level) {
    case "healthy":
      return "border-emerald-600/40 bg-emerald-100 text-emerald-900";
    case "warning":
      return "border-amber-600/50 bg-amber-100 text-amber-900";
    case "critical":
      return "border-red-600/50 bg-red-100 text-red-900";
    default:
      return "border-zinc-400 bg-white text-zinc-800 shadow-sm";
  }
}

function healthBadgeLabel(level: AdminNotificationWorkerHealthModel["healthLevel"]): string {
  switch (level) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "critical":
      return "Critical";
    default:
      return "Unknown";
  }
}

export function AdminNotificationWorkerHealthCard({ workerHealth }: Props) {
  const tone = healthTone(workerHealth.healthLevel);
  const showNeverRunEmptyState = !workerHealth.hasRun;

  return (
    <section className={`mt-6 rounded-xl border px-4 py-4 text-sm ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-sm font-semibold tracking-tight">Last worker run</p>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${healthBadgeClass(workerHealth.healthLevel)}`}
        >
          {healthBadgeLabel(workerHealth.healthLevel)}
        </span>
        {workerHealth.ageMinutes != null ? (
          <span className="text-xs text-zinc-600">
            {workerHealth.ageMinutes === 0 ? "just now" : `${workerHealth.ageMinutes}m ago`}
          </span>
        ) : null}
      </div>

      {showNeverRunEmptyState ? (
        <div className="mt-3 space-y-1">
          <p className="text-base font-semibold leading-snug">Never run</p>
          <p className="text-xs text-zinc-600">
            Run the notification cron once to begin worker history.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm font-medium leading-snug">{workerHealth.healthMessage}</p>
      )}

      {workerHealth.hasRun ? (
        <>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 sm:text-sm">
            <div>
              <dt className="text-zinc-600">Last completed</dt>
              <dd className="font-medium">{formatCompletedAt(workerHealth.completedAt)}</dd>
            </div>
            <div>
              <dt className="text-zinc-600">Run outcome</dt>
              <dd className="font-medium">
                {workerHealth.ok ? "Completed" : "Failed (route error)"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Delivery at run</dt>
              <dd className="font-medium">
                {workerHealth.deliveryEnabled
                  ? `on (${workerHealth.emailProvider ?? "unknown"})`
                  : "off (no-op)"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Trigger</dt>
              <dd className="font-medium">
                {workerHealth.triggerSource === "manual" ? "Manual" : "Cron"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 font-mono text-xs text-zinc-700">
            reclaimed {workerHealth.reclaimed ?? 0} · scanned {workerHealth.scanned ?? 0} · sent{" "}
            {workerHealth.sent ?? 0} · skipped {workerHealth.skipped ?? 0} · dry-run{" "}
            {workerHealth.dryRun ?? 0} · failed {workerHealth.failed ?? 0}
          </p>
          {(workerHealth.failed ?? 0) > 0 || (workerHealth.errorCount ?? 0) > 0 ? (
            <p className="mt-2 text-xs text-zinc-600">
              Row-level failures recorded. use the failed queue filter below. Raw error payloads
              are not shown here.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
