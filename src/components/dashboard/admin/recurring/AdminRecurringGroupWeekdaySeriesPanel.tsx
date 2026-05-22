import Link from "next/link";
import type { AdminRecurringGroupWeekdaySeriesItem } from "@/features/recurring/server/recurringManagementTypes";
import { AdminRecurringSeriesActions } from "./AdminRecurringSeriesActions";
import { AdminRecurringRescheduleForm } from "./AdminRecurringRescheduleForm";

type Props = { series: AdminRecurringGroupWeekdaySeriesItem[] };

export function AdminRecurringGroupWeekdaySeriesPanel({ series }: Props) {
  if (series.length === 0) {
    return <p className="text-sm text-slate-600">No weekday series linked to this group.</p>;
  }

  return (
    <div className="space-y-4">
      {series.map((s) => (
        <article
          key={s.seriesId}
          className="rounded-xl border border-slate-100 bg-slate-50/40 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {s.weekdayLabel}
                {s.slotLabel ? ` · ${s.slotLabel}` : ""}
              </h3>
              <p className="text-sm text-slate-600">
                {s.statusLabel} · Next: {s.nextOccurrenceScheduleLabel ?? "-"}
                {s.nextOccurrencePaymentRequired ? " (payment required)" : ""}
              </p>
              <p className="text-xs text-slate-500">
                {s.unpaidChildCount} unpaid · {s.completedChildCount} completed
                {s.latestChildBookingId ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      href={`/admin/bookings/${s.latestChildBookingId}`}
                      className="font-medium text-blue-700"
                    >
                      Latest child
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <Link
              href={`/admin/recurring/${s.seriesId}`}
              className="text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              Series detail
            </Link>
          </div>
          <AdminRecurringSeriesActions seriesId={s.seriesId} actions={s.actions} compact />
          {s.actions.canRescheduleNext ? (
            <div className="mt-3">
              <AdminRecurringRescheduleForm
                seriesId={s.seriesId}
                currentNext={s.nextOccurrenceAt}
              />
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
