import Link from "next/link";
import type { RecurringSeriesTimelineEntry } from "@/features/recurring/server/recurringManagementTypes";

type Props = {
  entries: RecurringSeriesTimelineEntry[];
  bookingBasePath?: "/admin/bookings" | "/customer/bookings";
};

export function AdminRecurringSeriesTimeline({
  entries,
  bookingBasePath = "/admin/bookings",
}: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-600">No visits in this series yet.</p>;
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
              {e.isAnchor ? (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                  First paid visit
                </span>
              ) : e.isGeneratedChild ? (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Generated
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-sm text-slate-600">
              {e.status} · {e.paymentLabel}
            </p>
          </div>
          <Link
            href={`${bookingBasePath}/${e.bookingId}`}
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Open booking
          </Link>
        </li>
      ))}
    </ol>
  );
}
