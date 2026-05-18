import Link from "next/link";
import type { AdminOperationalQueueCountItem } from "@/features/dashboards/server/adminOperationalQueueCounts";
import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";

type Props = {
  queues: AdminOperationalQueueCountItem[];
  /** Highlights the chip matching the active bookings filter, when present. */
  activeFilter?: AdminBookingFilter;
};

function toneClasses(tone: AdminOperationalQueueCountItem["tone"], active: boolean): string {
  if (active) {
    return "border-zinc-900 bg-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-2";
  }
  switch (tone) {
    case "danger":
      return "border-red-200 bg-red-50 text-red-950 hover:border-red-300";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300";
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

export function AdminOperationalQueueStrip({ queues, activeFilter }: Props) {
  return (
    <section aria-label="Operational queues" className="mb-6">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Operational queues
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">
        Exact counts across all bookings. Read-only — open a queue to review and act.
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {queues.map((queue) => {
          const queueFilter = filterFromHref(queue.href);
          const active = Boolean(activeFilter && queueFilter === activeFilter);
          return (
            <Link
              key={queue.key}
              href={queue.href}
              aria-current={active ? "true" : undefined}
              className={`flex min-w-[9.5rem] shrink-0 flex-col rounded-xl border px-3 py-2.5 transition-colors ${toneClasses(queue.tone, active)}`}
            >
              <span className="text-xs font-medium leading-tight">{queue.label}</span>
              <span className="mt-1 text-xl font-semibold tabular-nums">{queue.count}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
