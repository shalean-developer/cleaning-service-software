import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import type {
  AdminCleanerNetworkCardModel,
  AdminCleanerNetworkStatusTone,
} from "@/features/cleaners/server/admin/adminCleanersNetworkDisplay";

function statusBadgeClass(tone: AdminCleanerNetworkStatusTone): string {
  const base =
    "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide";
  switch (tone) {
    case "success":
      return `${base} bg-emerald-100 text-emerald-800`;
    case "info":
      return `${base} bg-blue-100 text-blue-800`;
    case "warning":
      return `${base} bg-orange-100 text-orange-800`;
    default:
      return `${base} bg-slate-100 text-slate-600`;
  }
}

type Props = {
  model: AdminCleanerNetworkCardModel;
};

export function AdminCleanerNetworkCard({ model }: Props) {
  return (
    <Link
      href={model.href}
      className="block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-800"
            aria-hidden
          >
            {model.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{model.name}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
              <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="truncate">{model.areaLabel}</span>
            </p>
          </div>
        </div>
        <span className={statusBadgeClass(model.statusTone)}>{model.statusLabel}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Rating
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-900">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={1.5} aria-hidden />
            <span>{model.ratingLabel}</span>
          </p>
          <p className="text-[11px] text-slate-500">{model.reviewsLabel}</p>
        </div>
        <div className="min-w-0 border-x border-slate-100 px-2 text-center sm:px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Completion
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{model.completionLabel}</p>
          <p className="text-[11px] text-slate-500">all-time</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Today</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{model.todayPrimaryLabel}</p>
          <p className="text-[11px] text-slate-500">{model.todaySecondaryLabel}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {model.badgeLabels.length > 0 ? (
            model.badgeLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-800"
              >
                {label}
              </span>
            ))
          ) : (
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              -
            </span>
          )}
        </div>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
          {model.activityLabel}
        </span>
      </div>
    </Link>
  );
}
