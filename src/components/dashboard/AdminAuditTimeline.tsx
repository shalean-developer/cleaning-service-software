import type { AdminAuditEntry } from "@/features/dashboards/server/types";

type Props = {
  audits: AdminAuditEntry[];
};

export function AdminAuditTimeline({ audits }: Props) {
  if (audits.length === 0) {
    return <p className="mt-2 text-sm text-zinc-600">No audit rows.</p>;
  }

  return (
    <ul className="mt-3 space-y-3">
      {audits.map((a) => (
        <li
          key={a.id}
          className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-800"
        >
          <p className="font-mono font-medium">
            {a.command ?? "-"}: {a.from ?? "∅"} → {a.to ?? "∅"}
          </p>
          <p className="mt-1 text-zinc-600">
            {new Date(a.at).toLocaleString("en-ZA")}
            {a.actorType ? ` · actor ${a.actorType}` : ""}
          </p>
          {a.reason ? (
            <p className="mt-1 text-zinc-700">
              <span className="text-zinc-500">Reason:</span> {a.reason}
            </p>
          ) : null}
          {a.idempotencyKey ? (
            <p className="mt-1 truncate font-mono text-zinc-500" title={a.idempotencyKey}>
              idempotency: {a.idempotencyKey}
            </p>
          ) : null}
          {a.metadataSummary ? (
            <p className="mt-1 text-zinc-600">
              <span className="text-zinc-500">Metadata:</span> {a.metadataSummary}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
