import type { MonthlyGovernanceTimelineEvent } from "@/features/monthly-billing/monthlyAccountGovernanceTypes";

type Props = {
  events: MonthlyGovernanceTimelineEvent[];
  compact?: boolean;
};

const KIND_STYLES: Record<MonthlyGovernanceTimelineEvent["kind"], string> = {
  governance_state: "bg-sky-100 text-sky-900",
  credit_limit: "bg-violet-100 text-violet-900",
  override: "bg-amber-100 text-amber-900",
  finance_review: "bg-indigo-100 text-indigo-900",
  suspension: "bg-red-100 text-red-900",
  note: "bg-zinc-100 text-zinc-800",
  dispute: "bg-orange-100 text-orange-900",
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

function groupEventsByDay(events: MonthlyGovernanceTimelineEvent[]) {
  const groups: { dayKey: string; heading: string; events: MonthlyGovernanceTimelineEvent[] }[] = [];
  for (const event of events) {
    const key = dayKey(event.at);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === key) {
      last.events.push(event);
    } else {
      groups.push({ dayKey: key, heading: formatDayHeading(event.at), events: [event] });
    }
  }
  return groups;
}

export function AdminMonthlyGovernanceTimeline({ events, compact = false }: Props) {
  if (events.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-4 text-center text-sm text-zinc-600"
        data-testid="monthly-governance-timeline-empty"
      >
        No governance activity recorded yet.
      </div>
    );
  }

  const groups = groupEventsByDay(events);

  return (
    <div className="space-y-4" data-testid="monthly-governance-timeline">
      {groups.map((group) => (
        <section key={group.dayKey} aria-label={group.heading}>
          {!compact ? (
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {group.heading}
            </h4>
          ) : null}
          <ol className="space-y-2">
            {group.events.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                data-testid="monthly-governance-timeline-event"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND_STYLES[event.kind]}`}
                  >
                    {event.kind.replace(/_/g, " ")}
                  </span>
                  <time className="text-xs text-zinc-500" dateTime={event.at}>
                    {formatEventTime(event.at)}
                  </time>
                  {event.adminName ? (
                    <span className="text-xs text-zinc-500">by {event.adminName}</span>
                  ) : null}
                </div>
                <p className="mt-1 font-medium text-zinc-900">{event.title}</p>
                {event.detail ? <p className="text-zinc-600">{event.detail}</p> : null}
                {event.reason ? (
                  <p className="mt-1 text-xs text-zinc-500">Reason: {event.reason}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
