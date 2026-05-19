import Link from "next/link";
import type { AdminOperationalQueueCountItem } from "@/features/dashboards/server/adminOperationalQueueCounts";
import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";

type Props = {
  queues: AdminOperationalQueueCountItem[];
  /** Highlights the chip matching the active bookings filter, when present. */
  activeFilter?: AdminBookingFilter;
  /** Compact mode for assignments page — hides guide copy. */
  compact?: boolean;
};

function toneClasses(tone: AdminOperationalQueueCountItem["tone"], active: boolean): string {
  if (active) {
    return "border-zinc-900 bg-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-2";
  }
  switch (tone) {
    case "danger":
      return "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300";
    case "warning":
      return "border-amber-200 bg-amber-50/80 text-amber-950 hover:border-amber-300";
    case "info":
      return "border-sky-200 bg-sky-50 text-sky-950 hover:border-sky-300";
    default:
      return "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300";
  }
}

function filterFromHref(href: string): string | null {
  const match = href.match(/[?&]filter=([^&]+)/);
  return match?.[1] ?? null;
}

export function AdminOperationalQueueStrip({
  queues,
  activeFilter,
  compact = false,
}: Props) {
  return (
    <section aria-label="Operational queues" className={compact ? "mb-0" : "mb-5"}>
      {!compact ? (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Queues</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Exact counts · open a queue to review
          </p>
        </>
      ) : null}
      <div
        className={
          compact
            ? "flex flex-wrap gap-2"
            : "-mx-4 mt-2.5 flex gap-2 overflow-x-auto scroll-px-4 px-4 pb-0.5 sm:mx-0 sm:px-0"
        }
      >
        {queues.map((queue) => {
          const queueFilter = filterFromHref(queue.href);
          const active = Boolean(activeFilter && queueFilter === activeFilter);
          return (
            <Link
              key={queue.key}
              href={queue.href}
              aria-current={active ? "true" : undefined}
              className={`flex shrink-0 flex-col rounded-lg border px-2 py-1.5 transition-colors ${
                compact ? "min-w-[7.25rem]" : "min-w-[8.5rem]"
              } ${toneClasses(queue.tone, active)}`}
            >
              <span className="text-[10px] font-medium leading-tight [overflow-wrap:anywhere]">
                {queue.label}
              </span>
              <span
                className={`mt-0.5 font-semibold tabular-nums ${compact ? "text-base" : "text-lg"}`}
              >
                {queue.count}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
