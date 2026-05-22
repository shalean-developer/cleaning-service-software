import Link from "next/link";
import { Calendar, MapPin, RefreshCw, UserRound } from "lucide-react";
import type {
  AdminCustomerCareFlagTone,
  AdminCustomerRegistryCardModel,
} from "@/features/customers/server/admin/adminCustomersRegistryDisplay";

function careFlagClass(tone: AdminCustomerCareFlagTone): string {
  const base =
    "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide";
  switch (tone) {
    case "brand":
      return `${base} bg-blue-100 text-blue-800`;
    case "warning":
      return `${base} bg-orange-100 text-orange-800`;
    default:
      return `${base} bg-slate-100 text-slate-600`;
  }
}

type Props = {
  model: AdminCustomerRegistryCardModel;
};

export function AdminCustomerRegistryCard({ model }: Props) {
  return (
    <Link
      href={model.href}
      className="block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-800"
            aria-hidden
          >
            {model.initials}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-900">{model.name}</p>
              {model.isRecurring ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                  <RefreshCw className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                  Recurring
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
              <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="truncate">{model.areaLabel}</span>
            </p>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-4 sm:gap-8">
          <div className="min-w-[4.5rem]">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Bookings
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
              {model.bookingsLabel}
            </p>
          </div>
          <div className="min-w-[4.5rem]">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Last visit
            </p>
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-900">
              <Calendar className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} aria-hidden />
              {model.lastVisitLabel}
            </p>
          </div>
          <div className="min-w-[4.5rem]">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Lifetime
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
              {model.lifetimeLabel}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap justify-end gap-1.5 sm:max-w-[12rem] sm:shrink-0">
          {model.careFlags.length > 0 ? (
            model.careFlags.map((flag) => (
              <span key={flag.id} className={careFlagClass(flag.tone)}>
                {flag.label}
              </span>
            ))
          ) : (
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              -
            </span>
          )}
        </div>
      </div>

      {model.footnote ? (
        <div className="flex items-center gap-1.5 border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 text-xs text-slate-600 sm:px-5">
          <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
          <span>{model.footnote}</span>
        </div>
      ) : null}
    </Link>
  );
}
