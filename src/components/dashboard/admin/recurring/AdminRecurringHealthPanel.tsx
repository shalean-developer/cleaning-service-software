import Link from "next/link";
import type {
  RecurringHealthAlert,
  RecurringHealthReadModel,
  RecurringHealthSeverity,
} from "@/features/recurring/server/recurringHealthTypes";
import {
  ADMIN_DETAIL_CARD_CLASS,
  ADMIN_SECTION_MUTED_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
} from "@/features/dashboards/adminDisplay";

type Props = { model: RecurringHealthReadModel };

function severityBadgeClass(severity: RecurringHealthSeverity): string {
  switch (severity) {
    case "healthy":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "warning":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "critical":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

function AlertList({ alerts, emptyLabel }: { alerts: RecurringHealthAlert[]; emptyLabel: string }) {
  if (alerts.length === 0) {
    return <p className="text-sm text-emerald-800">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {alerts.map((a, i) => (
        <li
          key={`${a.code}-${i}`}
          className="flex flex-wrap items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          <span
            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${severityBadgeClass(a.severity)}`}
          >
            {a.severity}
          </span>
          <span className="font-mono text-xs text-zinc-500">{a.code}</span>
          <span className="text-zinc-800">{a.message}</span>
          {a.seriesId ? (
            <Link
              href={`/admin/recurring/${a.seriesId}`}
              className="text-xs font-medium text-blue-700 hover:text-blue-900"
            >
              Open series
            </Link>
          ) : null}
          {a.bookingId ? (
            <Link
              href={`/admin/bookings/${a.bookingId}`}
              className="text-xs font-medium text-blue-700 hover:text-blue-900"
            >
              Open booking
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function AdminRecurringHealthPanel({ model }: Props) {
  const generationAlerts = model.alerts.filter((a) =>
    ["STALE_NEXT_OCCURRENCE", "PAUSED_SERIES_NEW_CHILD", "DUPLICATE_OCCURRENCE"].includes(a.code),
  );
  const paymentAlerts = model.alerts.filter((a) =>
    [
      "OVERDUE_PAYMENT_REQUIRED",
      "CHILD_MISSING_PRICE",
      "UNPAID_CHILD_CLEANER_VISIBLE",
      "CANCELLED_SERIES_UNPAID_CHILD",
    ].includes(a.code),
  );

  return (
    <div className="mt-8 space-y-6">
      <section className={ADMIN_DETAIL_CARD_CLASS}>
        <h2 className={ADMIN_SECTION_TITLE_CLASS}>Actions</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/admin/recurring"
            className="inline-flex min-h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Open recurring list
          </Link>
          <span className="inline-flex min-h-10 items-center rounded-xl border border-dashed border-zinc-300 px-4 text-sm text-zinc-600">
            Run audit: <code className="ml-1 text-xs">npm run ops:audit:recurring-bookings</code>
          </span>
          <span className="inline-flex min-h-10 items-center rounded-xl border border-dashed border-zinc-300 px-4 text-sm text-zinc-600">
            Soak test: <code className="ml-1 text-xs">npm run ops:soak:recurring-bookings</code>
          </span>
        </div>
      </section>

      <section className={ADMIN_DETAIL_CARD_CLASS}>
        <h2 className={ADMIN_SECTION_TITLE_CLASS}>Series health</h2>
        <p className={ADMIN_SECTION_MUTED_CLASS}>
          {model.seriesHealth.length} series tracked (limit {200}).
        </p>
        {model.staleOrRiskySeries.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-800">All series look healthy.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {model.staleOrRiskySeries.slice(0, 20).map((s) => (
              <li
                key={s.seriesId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <span>
                  {s.frequency} · {s.status}
                  {s.staleNextOccurrence ? " · stale next" : ""}
                  {s.unpaidChildCount > 0 ? ` · ${s.unpaidChildCount} unpaid` : ""}
                </span>
                <Link
                  href={`/admin/recurring/${s.seriesId}`}
                  className="font-medium text-blue-700 hover:text-blue-900"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={ADMIN_DETAIL_CARD_CLASS}>
        <h2 className={ADMIN_SECTION_TITLE_CLASS}>Generation health</h2>
        <AlertList alerts={generationAlerts} emptyLabel="Generation pipeline healthy." />
        {model.latestGenerationRuns.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-4">Completed</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2">Failures</th>
                </tr>
              </thead>
              <tbody>
                {model.latestGenerationRuns.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-4">{new Date(r.completedAt).toLocaleString("en-ZA")}</td>
                    <td className="py-2 pr-4">{r.status}</td>
                    <td className="py-2 pr-4">{r.childrenGenerated}</td>
                    <td className="py-2">{r.failuresCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={`${ADMIN_SECTION_MUTED_CLASS} mt-2`}>
            No generation runs logged yet. Trigger cron or wait for schedule.
          </p>
        )}
      </section>

      <section className={ADMIN_DETAIL_CARD_CLASS}>
        <h2 className={ADMIN_SECTION_TITLE_CLASS}>Payment-required children</h2>
        <AlertList alerts={paymentAlerts} emptyLabel="No payment integrity alerts." />
        {model.paymentRequiredBookings.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {model.paymentRequiredBookings.slice(0, 15).map((b) => (
              <li
                key={b.bookingId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <span>
                  {new Date(b.scheduledStart).toLocaleDateString("en-ZA")} · {b.status} · {b.ageHours}h
                  {b.overdue ? " · overdue" : ""}
                </span>
                <Link
                  href={`/admin/bookings/${b.bookingId}`}
                  className="font-medium text-blue-700 hover:text-blue-900"
                >
                  Open booking
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={ADMIN_DETAIL_CARD_CLASS}>
        <h2 className={ADMIN_SECTION_TITLE_CLASS}>All alerts</h2>
        <AlertList alerts={model.alerts} emptyLabel="No alerts — recurring engine healthy." />
      </section>

      <section className={ADMIN_DETAIL_CARD_CLASS}>
        <h2 className={ADMIN_SECTION_TITLE_CLASS}>Latest recurring audit events</h2>
        {model.recentAuditEvents.length === 0 ? (
          <p className="text-sm text-zinc-600">No recent series actions recorded.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {model.recentAuditEvents.map((e) => (
              <li key={`${e.seriesId}-${e.createdAt}-${e.action}`} className="text-sm text-zinc-700">
                <Link
                  href={`/admin/recurring/${e.seriesId}`}
                  className="font-medium text-blue-700 hover:text-blue-900"
                >
                  {e.action}
                </Link>{" "}
                · {e.actorType} · {new Date(e.createdAt).toLocaleString("en-ZA")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
