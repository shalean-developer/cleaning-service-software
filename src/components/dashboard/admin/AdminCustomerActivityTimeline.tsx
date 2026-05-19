import Link from "next/link";
import type {
  CustomerOperationalTimelineEvent,
  CustomerTimelineSource,
} from "@/features/customers/server/admin/customerOperationalTimelineTypes";
import { ADMIN_SECTION_MUTED_CLASS } from "@/features/dashboards/adminDisplay";

type Props = {
  events: CustomerOperationalTimelineEvent[];
};

const SOURCE_STYLES: Record<CustomerTimelineSource, string> = {
  Admin: "bg-amber-100 text-amber-900",
  Booking: "bg-sky-100 text-sky-900",
  Payment: "bg-violet-100 text-violet-900",
  Customer: "bg-emerald-100 text-emerald-900",
  System: "bg-zinc-100 text-zinc-700",
};

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayHeading(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupEventsByDay(
  events: CustomerOperationalTimelineEvent[],
): { dayKey: string; heading: string; events: CustomerOperationalTimelineEvent[] }[] {
  const groups: {
    dayKey: string;
    heading: string;
    events: CustomerOperationalTimelineEvent[];
  }[] = [];

  for (const event of events) {
    const key = dayKey(event.at);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === key) {
      last.events.push(event);
    } else {
      groups.push({
        dayKey: key,
        heading: formatDayHeading(event.at),
        events: [event],
      });
    }
  }

  return groups;
}

export function AdminCustomerActivityTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
        <p className={ADMIN_SECTION_MUTED_CLASS}>
          No customer activity recorded yet. Bookings, payments, and profile changes will appear
          here.
        </p>
      </div>
    );
  }

  const groups = groupEventsByDay(events);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.dayKey} aria-label={group.heading}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {group.heading}
          </h3>
          <ol className="space-y-0">
            {group.events.map((event, index) => {
              const isLast = index === group.events.length - 1;
              return (
                <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {!isLast ? (
                    <span
                      className="absolute left-[7px] top-3.5 h-[calc(100%-6px)] w-px bg-zinc-200"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className="relative z-[1] mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full bg-zinc-300 ring-2 ring-white"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${SOURCE_STYLES[event.source]}`}
                      >
                        {event.source}
                      </span>
                      <time className="text-xs text-zinc-500" dateTime={event.at}>
                        {formatEventTime(event.at)}
                      </time>
                    </div>
                    <p className="mt-1 text-sm font-medium text-zinc-900">{event.title}</p>
                    {event.detail ? (
                      <p className="mt-0.5 text-sm leading-relaxed text-zinc-600">{event.detail}</p>
                    ) : null}
                    {event.bookingHref ? (
                      <p className="mt-1.5">
                        <Link
                          href={event.bookingHref}
                          className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
                        >
                          View booking
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
