import type { LifecycleEvent } from "@/features/dashboards/server/lifecycleTimeline";

type Props = {
  events: LifecycleEvent[];
};

export function LifecycleTimeline({ events }: Props) {
  if (events.length === 0) {
    return <p className="text-sm text-zinc-500">No timeline events yet.</p>;
  }

  return (
    <ol className="space-y-4 border-l border-zinc-200 pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-zinc-400" />
          <p className="text-sm font-medium text-zinc-900">{event.title}</p>
          {event.detail ? <p className="text-xs text-zinc-600">{event.detail}</p> : null}
          <p className="text-xs text-zinc-400">{new Date(event.at).toLocaleString("en-ZA")}</p>
        </li>
      ))}
    </ol>
  );
}
