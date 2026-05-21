import Link from "next/link";
import { Calendar, Clock, MapPin, Sparkles } from "lucide-react";
import type {
  AdminBookingOpsCardModel,
  AdminBookingOpsStatusTone,
} from "@/features/dashboards/adminBookingsOperationsDisplay";

function statusPillClass(tone: AdminBookingOpsStatusTone): string {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide";
  switch (tone) {
    case "blue":
      return `${base} bg-blue-100 text-blue-800`;
    case "orange":
      return `${base} bg-orange-100 text-orange-800`;
    case "amber":
      return `${base} bg-amber-100 text-amber-900`;
    case "emerald":
      return `${base} bg-emerald-100 text-emerald-800`;
    default:
      return `${base} bg-slate-100 text-slate-700`;
  }
}

type Props = {
  model: AdminBookingOpsCardModel;
};

export function AdminBookingOperationsCard({ model }: Props) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
            aria-hidden
          >
            {model.initials}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {model.serviceTitle}{" "}
              <span className="font-medium text-slate-500">{model.bookingRef}</span>
            </p>
            <p className="mt-0.5 truncate text-sm text-slate-600">{model.customerLine}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {model.showRecurringBadge ? (
            <span className="inline-flex items-center rounded-full border border-indigo-200/80 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
              Series
            </span>
          ) : null}
          <span className={statusPillClass(model.primaryStatus.tone)}>
            {model.primaryStatus.label.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm text-slate-600 sm:px-5">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
          <span>
            {model.scheduleWhen} · {model.scheduleTime}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
          <span>{model.durationLabel}</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
          <span className="truncate">{model.addressLabel}</span>
        </span>
        <span className="font-semibold text-slate-900">{model.priceLabel}</span>
        <span
          className={
            model.cleanerWarning
              ? "font-medium text-orange-700"
              : "font-medium text-slate-700"
          }
        >
          {model.cleanerLabel}
        </span>
      </div>

      {model.alertLabels.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2.5 sm:px-5">
          {model.alertLabels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center rounded-full border border-rose-200/80 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-800"
            >
              {label.toUpperCase()}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
        <Link
          href={model.href}
          className="rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Reassign
        </Link>
        <Link
          href={model.href}
          className="rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Reschedule
        </Link>
        <Link
          href={model.href}
          className="rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Customer
        </Link>
        <Link
          href={model.href}
          className="rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Cancel
        </Link>
        <Link
          href={model.href}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Advance
        </Link>
      </div>
    </article>
  );
}
