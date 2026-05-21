import Link from "next/link";
import type { AdminRecurringSeriesListItem } from "@/features/recurring/server/recurringManagementTypes";
import { AdminRecurringSeriesActions } from "./AdminRecurringSeriesActions";

function statusTone(status: string): string {
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "paused") return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

type Props = { item: AdminRecurringSeriesListItem };

export function AdminRecurringSeriesCard({ item }: Props) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{item.customerName}</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {item.serviceLabel} · {item.frequencyLabel}
          </p>
          <p className="mt-0.5 truncate text-sm text-slate-500">{item.addressSummary}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTone(item.status)}`}
          >
            {item.statusLabel}
          </span>
          {item.nextOccurrencePaymentRequired ? (
            <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-900">
              Payment required
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-sm text-slate-600 sm:px-5">
        <span>
          Next:{" "}
          <span className="font-medium text-slate-900">
            {item.nextOccurrenceScheduleLabel ?? "—"}
          </span>
        </span>
        <span>{item.childBookingsCount} visits</span>
        {item.suburb ? <span>{item.suburb}</span> : null}
      </div>
      <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
        <AdminRecurringSeriesActions seriesId={item.seriesId} actions={item.actions} compact />
        <p className="mt-2">
          <Link
            href={`/admin/recurring/${item.seriesId}`}
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Open detail →
          </Link>
        </p>
      </div>
    </article>
  );
}
