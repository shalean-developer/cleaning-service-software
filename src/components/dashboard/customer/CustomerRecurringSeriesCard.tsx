import Link from "next/link";
import type { CustomerRecurringSeriesListItem } from "@/features/recurring/server/recurringManagementTypes";

type Props = { item: CustomerRecurringSeriesListItem };

export function CustomerRecurringSeriesCard({ item }: Props) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{item.serviceLabel}</h2>
          <p className="text-sm text-zinc-600">
            {item.frequencyLabel} · {item.statusLabel}
          </p>
          <p className="text-sm text-zinc-500">{item.locationSummary}</p>
        </div>
        {item.nextOccurrencePaymentRequired ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
            Pay to confirm
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-zinc-700">
        {item.nextOccurrencePaymentRequired
          ? "Your next recurring visit is ready for payment"
          : "Next visit:"}{" "}
        <span className="font-medium">{item.nextOccurrenceScheduleLabel ?? "To be scheduled"}</span>
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {item.unpaidChildCount} unpaid · {item.paidUpcomingCount} paid upcoming ·{" "}
        {item.completedVisitCount} completed
      </p>
      <Link
        href={`/customer/bookings/recurring/${item.seriesId}`}
        className="mt-3 inline-block text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
      >
        View series →
      </Link>
    </article>
  );
}
