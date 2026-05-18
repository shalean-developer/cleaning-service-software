import { AdminRunbookRef } from "@/components/dashboard/AdminRunbookRef";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { AdminOperationalQueueCard } from "@/features/dashboards/adminOperationalQueues";
import {
  labelForOperationalQueueSeverity,
  toneForOperationalQueueSeverity,
} from "@/features/dashboards/adminOperationalQueues";

type Props = {
  card: AdminOperationalQueueCard;
};

function toneBorderClasses(tone: AdminOperationalQueueCard["tone"]): string {
  switch (tone) {
    case "danger":
      return "border-red-200 bg-red-50/40";
    case "warning":
      return "border-amber-200 bg-amber-50/40";
    case "info":
      return "border-sky-200 bg-sky-50/40";
    default:
      return "border-zinc-200 bg-zinc-50/60";
  }
}

/** Compact active-filter guidance on /admin/bookings (7A-2b). */
export function AdminOperationalQueueContextCard({ card }: Props) {
  return (
    <section
      aria-label={`${card.label} queue context`}
      className={`mb-4 rounded-xl border px-4 py-3 ${toneBorderClasses(card.tone)}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={labelForOperationalQueueSeverity(card.severity)}
              tone={toneForOperationalQueueSeverity(card.severity)}
            />
            <h2 className="text-sm font-semibold text-zinc-900">{card.label}</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-700">{card.summary}</p>
        </div>
        <p className="shrink-0 text-lg font-semibold tabular-nums text-zinc-900">
          {card.count}
          <span className="ml-1 text-xs font-normal text-zinc-500">
            {card.count === 1 ? "booking" : "bookings"}
          </span>
        </p>
      </div>

      {card.count === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">No current bookings in this queue.</p>
      ) : null}

      <p className="mt-2 text-sm text-zinc-800">
        <span className="font-medium">What to do:</span> {card.recommendedAction}
      </p>
      {card.secondaryNote ? (
        <p className="mt-1.5 text-xs text-zinc-500">{card.secondaryNote}</p>
      ) : null}

      <p className="mt-2 text-xs text-zinc-500">
        Exact count across all bookings. This list shows up to 200 newest matches by last update.
      </p>

      <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <AdminRunbookRef runbookKey={card.runbookKey} />
        {card.secondaryRunbookKey ? (
          <AdminRunbookRef runbookKey={card.secondaryRunbookKey} />
        ) : null}
      </div>
    </section>
  );
}
