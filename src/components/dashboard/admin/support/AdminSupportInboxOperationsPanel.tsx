import type { SupportOperationsSnapshot } from "@/features/support/server/supportOperationsReadModel";

type Props = {
  operations: SupportOperationsSnapshot;
};

export function AdminSupportInboxOperationsPanel({ operations }: Props) {
  const { breakdown, analytics } = operations;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Operations intelligence</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Visibility only — support requests do not auto-change bookings, payments, or dispatch.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            One-off bookings
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-zinc-500">Open</dt>
            <dd className="font-medium tabular-nums">{breakdown.booking_support.open}</dd>
            <dt className="text-zinc-500">Urgent</dt>
            <dd className="font-medium tabular-nums">{breakdown.booking_support.urgent}</dd>
            <dt className="text-zinc-500">SLA breached</dt>
            <dd className="font-medium tabular-nums">{breakdown.booking_support.breached}</dd>
            <dt className="text-zinc-500">Created today</dt>
            <dd className="font-medium tabular-nums">{breakdown.booking_support.createdToday}</dd>
          </dl>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Recurring
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-zinc-500">Open</dt>
            <dd className="font-medium tabular-nums">{breakdown.recurring_support.open}</dd>
            <dt className="text-zinc-500">Urgent</dt>
            <dd className="font-medium tabular-nums">{breakdown.recurring_support.urgent}</dd>
            <dt className="text-zinc-500">SLA breached</dt>
            <dd className="font-medium tabular-nums">{breakdown.recurring_support.breached}</dd>
            <dt className="text-zinc-500">Volume</dt>
            <dd className="font-medium tabular-nums">{analytics.recurringVolume}</dd>
          </dl>
        </div>
      </div>

      {analytics.topSuburbs.length > 0 ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Suburb hotspots
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {analytics.topSuburbs.map((row) => (
              <li
                key={row.suburb}
                className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700"
              >
                {row.suburb} ({row.count})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {operations.oldestUnresolvedId ? (
        <p className="mt-3 text-xs text-zinc-600">
          Oldest unresolved:{" "}
          <span className="font-medium text-zinc-800">
            {Math.round((operations.oldestUnresolvedAgeMinutes ?? 0) / 60)}h ago
          </span>
        </p>
      ) : null}
    </section>
  );
}
