import Link from "next/link";
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
      return "border-red-200";
    case "warning":
      return "border-amber-200";
    case "info":
      return "border-sky-200";
    default:
      return "border-zinc-200";
  }
}

export function AdminOperationalQueueExplainCard({ card }: Props) {
  const viewAllLabel = card.count === 0 ? "View list" : `View all (${card.count})`;

  return (
    <article
      className={`flex h-full flex-col rounded-xl border bg-white p-4 ${toneBorderClasses(card.tone)}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <StatusBadge
            label={labelForOperationalQueueSeverity(card.severity)}
            tone={toneForOperationalQueueSeverity(card.severity)}
          />
          <h3 className="mt-2 text-sm font-semibold text-zinc-900">{card.label}</h3>
        </div>
        <p className="shrink-0 text-2xl font-semibold tabular-nums text-zinc-900">{card.count}</p>
      </header>

      {card.count === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">No current bookings in this queue.</p>
      ) : null}

      <p className="mt-3 text-sm text-zinc-700">{card.summary}</p>

      <div className="mt-3">
        <p className="text-xs font-medium text-zinc-800">Why bookings appear here</p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-zinc-600">
          {card.whyHere.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-zinc-800">What to do</p>
        <p className="mt-1 text-sm text-zinc-700">{card.recommendedAction}</p>
        {card.secondaryNote ? (
          <p className="mt-1.5 text-xs text-zinc-500">{card.secondaryNote}</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-3">
        <Link
          href={card.href}
          className="text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500"
        >
          {viewAllLabel} →
        </Link>
        <AdminRunbookRef runbookKey={card.runbookKey} />
        {card.secondaryRunbookKey ? (
          <AdminRunbookRef runbookKey={card.secondaryRunbookKey} />
        ) : null}
      </div>
    </article>
  );
}