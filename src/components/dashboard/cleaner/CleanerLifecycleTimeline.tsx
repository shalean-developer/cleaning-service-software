import type { LifecycleEvent } from "@/features/dashboards/server/lifecycleTimeline";

type Props = {
  events: LifecycleEvent[];
};

function isTechnicalDetail(detail: string): boolean {
  return /^Ref\s/i.test(detail.trim()) || detail.includes("MARK_");
}

function displayTitleForEvent(title: string, isCurrent: boolean): string {
  if (isCurrent && title.startsWith("Current: ")) {
    return title.slice("Current: ".length);
  }
  return title;
}

function formatEventTime(at: string): string {
  return new Date(at).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CleanerLifecycleTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-zinc-500">
        Updates will appear here as the job progresses.
      </p>
    );
  }

  const currentIndex = events.findIndex((event) => event.id === "current");
  const activeIndex = currentIndex >= 0 ? currentIndex : events.length - 1;

  return (
    <ol className="relative space-y-0">
      {events.map((event, index) => {
        const isCurrent = index === activeIndex;
        const isComplete = index < activeIndex;
        const isLast = index === events.length - 1;
        const friendlyDetail =
          event.detail && !isTechnicalDetail(event.detail) ? event.detail : null;
        const displayTitle = displayTitleForEvent(event.title, isCurrent);

        return (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span
                className={`absolute left-[7px] top-3.5 h-[calc(100%-6px)] w-px ${
                  isComplete ? "bg-zinc-300" : "bg-zinc-100"
                }`}
                aria-hidden
              />
            ) : null}

            <span
              className={`relative z-[1] mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white ${
                isCurrent ? "bg-zinc-900" : isComplete ? "bg-zinc-400" : "bg-zinc-200"
              }`}
              aria-hidden
            />

            <section className="min-w-0 flex-1 pb-0.5">
              <p
                className={`text-sm leading-snug ${
                  isCurrent ? "font-semibold text-zinc-900" : "font-medium text-zinc-600"
                }`}
              >
                {displayTitle}
                {isCurrent ? (
                  <span className="ml-1.5 text-xs font-normal text-zinc-500">Now</span>
                ) : null}
              </p>
              {friendlyDetail ? (
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{friendlyDetail}</p>
              ) : null}
              <p className="mt-1 text-xs text-zinc-400">{formatEventTime(event.at)}</p>
            </section>
          </li>
        );
      })}
    </ol>
  );
}
