import type { CustomerRecurringGroupRequestItem } from "@/features/recurring/server/recurringManagementTypes";

type Props = {
  open: CustomerRecurringGroupRequestItem[];
  acknowledged: CustomerRecurringGroupRequestItem[];
  resolved: CustomerRecurringGroupRequestItem[];
};

function Section({ title, items }: { title: string; items: CustomerRecurringGroupRequestItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {items.map((req) => (
        <div
          key={req.id}
          className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm text-zinc-700"
        >
          <p className="font-medium text-zinc-900">
            {req.requestTypeLabel} · {req.scopeLabel}
            {req.targetWeekdayLabel ? ` · ${req.targetWeekdayLabel}` : ""}
          </p>
          <p className="text-xs text-zinc-500">
            {req.statusLabel} · {new Date(req.createdAt).toLocaleString("en-ZA")}
          </p>
          {req.requestedDateTimeIso ? (
            <p className="text-xs text-zinc-600">
              Requested time: {new Date(req.requestedDateTimeIso).toLocaleString("en-ZA")}
            </p>
          ) : null}
          {req.note ? <p className="mt-1 text-zinc-600">&ldquo;{req.note}&rdquo;</p> : null}
        </div>
      ))}
    </div>
  );
}

export function CustomerRecurringGroupRequestHistory({ open, acknowledged, resolved }: Props) {
  const total = open.length + acknowledged.length + resolved.length;
  if (total === 0) {
    return <p className="text-sm text-zinc-600">No requests yet for this schedule.</p>;
  }
  return (
    <div className="space-y-4">
      <Section title="Open" items={open} />
      <Section title="Acknowledged" items={acknowledged} />
      <Section title="Resolved" items={resolved} />
    </div>
  );
}
