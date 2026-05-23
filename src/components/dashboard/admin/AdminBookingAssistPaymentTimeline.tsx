import type { AdminAssistTimelineEntry } from "@/features/bookings/server/admin/buildAdminBookingAssistTimeline";

type Props = {
  entries: AdminAssistTimelineEntry[];
};

function formatWhen(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  });
}

export function AdminBookingAssistPaymentTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-600" data-testid="admin-assist-payment-timeline-empty">
        No payment request history yet.
      </p>
    );
  }

  return (
    <ol
      className="space-y-3 border-l border-sky-200 pl-4"
      data-testid="admin-assist-payment-timeline"
    >
      {entries.map((entry) => (
        <li key={entry.id} className="relative text-sm">
          <span
            className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-sky-600"
            aria-hidden
          />
          <p className="font-medium text-zinc-900">{entry.title}</p>
          <p className="text-xs text-zinc-500">{formatWhen(entry.at)}</p>
          {entry.description ? (
            <p className="mt-0.5 text-xs text-zinc-600">{entry.description}</p>
          ) : null}
          {entry.reference ? (
            <p className="mt-1 font-mono text-xs text-zinc-700">Ref: {entry.reference}</p>
          ) : null}
          {entry.previousReference ? (
            <p className="font-mono text-xs text-zinc-500">
              Supersedes: {entry.previousReference}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
