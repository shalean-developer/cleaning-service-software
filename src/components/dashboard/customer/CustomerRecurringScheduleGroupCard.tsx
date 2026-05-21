import Link from "next/link";
import type { CustomerRecurringScheduleGroupListItem } from "@/features/recurring/server/recurringManagementTypes";

type Props = { item: CustomerRecurringScheduleGroupListItem };

export function CustomerRecurringScheduleGroupCard({ item }: Props) {
  const payDue = item.unpaidUpcomingCount > 0;
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{item.serviceLabel}</h2>
          <p className="text-sm text-zinc-600">
            {item.frequencyLabel} · {item.selectedDaysLabel} · {item.statusLabel}
          </p>
        </div>
        {payDue ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
            Pay to confirm
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-zinc-700">
        Next upcoming:{" "}
        <span className="font-medium">{item.nextVisitsSummary}</span>
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {item.unpaidUpcomingCount} unpaid upcoming visit
        {item.unpaidUpcomingCount === 1 ? "" : "s"} across {item.series.length} weekday
        {item.series.length === 1 ? "" : "s"}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {item.series.map((s) => (
          <Link
            key={s.seriesId}
            href={`/customer/bookings/recurring/${s.seriesId}`}
            className="text-sm font-medium text-zinc-800 underline-offset-2 hover:underline"
          >
            {s.frequencyLabel} slot →
          </Link>
        ))}
      </div>
    </article>
  );
}
