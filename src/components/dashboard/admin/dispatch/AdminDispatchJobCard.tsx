import Link from "next/link";
import { AlertTriangle, MapPin } from "lucide-react";
import type { DispatchOrchestrationJobCard } from "@/features/dashboards/adminDispatchOrchestrationDisplay";

function statusBadgeClass(status: DispatchOrchestrationJobCard["laneStatus"]): string {
  switch (status) {
    case "matched":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200/80";
    case "matching":
      return "bg-amber-100 text-amber-900 ring-amber-200/80";
    case "conflict":
      return "bg-red-100 text-red-800 ring-red-200/80";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200/80";
  }
}

function cardBorderClass(status: DispatchOrchestrationJobCard["laneStatus"]): string {
  switch (status) {
    case "matched":
      return "border-emerald-200/80";
    case "matching":
      return "border-amber-200/80";
    case "conflict":
      return "border-red-200/80";
    default:
      return "border-slate-200/80";
  }
}

type Props = {
  job: DispatchOrchestrationJobCard;
};

export function AdminDispatchJobCard({ job }: Props) {
  const primaryCta =
    job.laneStatus === "matched"
      ? "Reassign"
      : job.laneStatus === "conflict"
        ? "Resolve"
        : "Match";

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${cardBorderClass(job.laneStatus)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{job.serviceTitle}</p>
          <p className="text-xs font-medium text-slate-500">{job.bookingRef}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusBadgeClass(job.laneStatus)}`}
        >
          {job.statusLabel}
        </span>
      </div>

      {job.showRecurringBadge ? (
        <span className="mt-2 inline-flex w-fit rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
          Recurring
        </span>
      ) : null}

      <p className="mt-2 truncate text-sm text-slate-700">{job.customerLine}</p>
      <p className="mt-1 text-xs text-slate-500">
        {job.scheduleTime} · {job.durationLabel}
      </p>
      <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span className="line-clamp-2">{job.addressLabel}</span>
      </p>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        {job.cleanerInitials ? (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700"
            aria-hidden
          >
            {job.cleanerInitials}
          </span>
        ) : (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"
            aria-hidden
          >
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{job.cleanerLabel}</p>
      </div>

      {job.alertTag ? (
        <p
          className={`mt-2 text-[10px] font-semibold uppercase tracking-wide ${
            job.laneStatus === "conflict" || job.alertTag.toLowerCase().includes("no cleaner")
              ? "text-red-700"
              : "text-amber-800"
          }`}
        >
          {job.alertTag}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={job.href}
          className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {primaryCta}
        </Link>
        <Link
          href={job.href}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Notes
        </Link>
      </div>
    </article>
  );
}
