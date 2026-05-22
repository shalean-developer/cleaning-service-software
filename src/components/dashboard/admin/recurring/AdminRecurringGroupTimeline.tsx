import Link from "next/link";
import type { AdminRecurringGroupTimelineEntry } from "@/features/recurring/server/recurringManagementTypes";

type Props = { entries: AdminRecurringGroupTimelineEntry[] };

export function AdminRecurringGroupTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-600">No generated visits under this group yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li
          key={e.bookingId}
          className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3"
        >
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {e.scheduleLabel}
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {e.weekdayLabel}
              </span>
              {e.paymentRequired ? (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  Payment required
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-sm text-slate-600">
              {e.customerStatusLabel} · {e.paymentLabel}
              {e.priceLabel !== "-" ? ` · ${e.priceLabel}` : ""}
              {e.cleanerLabel ? ` · ${e.cleanerLabel}` : ""}
            </p>
          </div>
          <Link
            href={e.adminBookingHref}
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Open booking
          </Link>
        </li>
      ))}
    </ol>
  );
}
