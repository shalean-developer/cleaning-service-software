import Link from "next/link";
import type { CustomerRecurringGroupWeekdaySeriesItem } from "@/features/recurring/server/recurringManagementTypes";

type Props = { series: CustomerRecurringGroupWeekdaySeriesItem[] };

export function CustomerRecurringGroupWeekdayPanel({ series }: Props) {
  if (series.length === 0) {
    return <p className="text-sm text-zinc-600">No weekday series linked.</p>;
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {series.map((s) => (
        <li key={s.seriesId} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0">
          <div>
            <p className="font-medium text-zinc-900">
              {s.weekdayLabel}
              {s.slotLabel ? ` · ${s.slotLabel}` : ""}
            </p>
            <p className="text-sm text-zinc-600">
              Next: {s.nextOccurrenceScheduleLabel ?? "To be scheduled"} · {s.statusLabel}
            </p>
            <p className="text-xs text-zinc-500">
              {s.unpaidChildCount} unpaid · {s.completedChildCount} completed
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {s.nextOccurrencePaymentRequired ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                Pay to confirm
              </span>
            ) : null}
            <Link
              href={s.seriesDetailHref}
              className="text-sm font-medium text-zinc-800 underline-offset-2 hover:underline"
            >
              Weekday detail
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
