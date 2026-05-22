import type { CronHealthLevel, CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";
import {
  ADMIN_DETAIL_CARD_CLASS,
  ADMIN_SECTION_MUTED_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
} from "@/features/dashboards/adminDisplay";

type Props = {
  generatedAt: string;
  cronSecretConfigured: boolean;
  jobs: CronJobHealthSnapshot[];
  /** Omit outer card when nested in AdminDetailSection. */
  embedded?: boolean;
};

export function AdminCronHealthCriticalBanner({ jobs }: { jobs: CronJobHealthSnapshot[] }) {
  if (jobs.length === 0) return null;
  return (
    <section
      className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-950"
      role="alert"
    >
      <p className="font-semibold">Critical cron jobs need attention</p>
      <ul className="mt-1.5 space-y-0.5 text-xs">
        {jobs.map((job) => (
          <li key={job.id}>
            <span className="font-medium">{job.name}</span>. {job.statusMessage}
          </li>
        ))}
      </ul>
    </section>
  );
}

function statusBadgeClass(level: CronHealthLevel): string {
  switch (level) {
    case "healthy":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "warning":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "critical":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

function statusLabel(level: CronHealthLevel): string {
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

export function AdminCronHealthPanel({
  generatedAt,
  cronSecretConfigured,
  jobs,
  embedded = false,
}: Props) {
  const body = (
    <>
      {!embedded ? (
        <h2 className={ADMIN_SECTION_TITLE_CLASS}>Background job health</h2>
      ) : null}
      <p className={ADMIN_SECTION_MUTED_CLASS}>
        Launch-critical cron visibility (read-only). Generated{" "}
        {new Date(generatedAt).toLocaleString("en-ZA")}. CRON_SECRET on app:{" "}
        {cronSecretConfigured ? "configured" : "missing"}.
      </p>

      <ul className="mt-4 space-y-3">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(job.status)}`}
              >
                {statusLabel(job.status)}
              </span>
              <span className="font-semibold text-zinc-900">{job.name}</span>
              {!job.enabled ? (
                <span className="text-xs text-zinc-500">(disabled)</span>
              ) : null}
              {job.launchRequired ? (
                <span className="text-xs font-medium text-zinc-600">Launch required</span>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-zinc-600">
              <code className="text-[11px]">{job.routePath}</code> · {job.scheduleHint}
            </p>
            <p className="mt-1 text-xs text-zinc-700">{job.statusMessage}</p>
            <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="font-medium uppercase tracking-wide text-zinc-500">
                  {job.backlogLabel}
                </dt>
                <dd className="mt-0.5 tabular-nums text-zinc-900">{job.backlogCount}</dd>
              </div>
              <div>
                <dt className="font-medium uppercase tracking-wide text-zinc-500">
                  Last success
                </dt>
                <dd className="mt-0.5 text-zinc-900">
                  {job.lastSuccessfulRunAt
                    ? new Date(job.lastSuccessfulRunAt).toLocaleString("en-ZA")
                    : job.hasRunTelemetry
                      ? "-"
                      : "No telemetry"}
                </dd>
              </div>
              <div>
                <dt className="font-medium uppercase tracking-wide text-zinc-500">
                  Last failure
                </dt>
                <dd className="mt-0.5 text-zinc-900">
                  {job.lastFailureRunAt
                    ? new Date(job.lastFailureRunAt).toLocaleString("en-ZA")
                    : job.hasRunTelemetry
                      ? "-"
                      : "No telemetry"}
                </dd>
              </div>
              <div>
                <dt className="font-medium uppercase tracking-wide text-zinc-500">
                  Failures (24h)
                </dt>
                <dd className="mt-0.5 tabular-nums text-zinc-900">
                  {job.recentFailureCount24h ?? "-"}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-zinc-500">{job.docPath}</p>
          </li>
        ))}
      </ul>
    </>
  );

  if (embedded) {
    return <div>{body}</div>;
  }

  return <section className={`${ADMIN_DETAIL_CARD_CLASS} p-4 sm:p-5`}>{body}</section>;
}
