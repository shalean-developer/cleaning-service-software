import type { AdminOperationalAuditEntry } from "@/features/dashboards/server/types";

type Props = {
  audits: AdminOperationalAuditEntry[];
};

function outcomeClass(outcome: string): string {
  switch (outcome) {
    case "success":
      return "text-emerald-700";
    case "idempotent":
      return "text-zinc-600";
    case "rejected":
      return "text-amber-700";
    case "failed":
      return "text-red-700";
    default:
      return "text-zinc-700";
  }
}

export function AdminOperationalTimeline({ audits }: Props) {
  if (audits.length === 0) {
    return (
      <p className="mt-2 text-sm text-zinc-600">
        No admin operations recorded for this booking yet.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-3">
      {audits.map((a) => (
        <li
          key={a.id}
          className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-xs text-zinc-800"
        >
          <p className="font-medium">
            {a.actionLabel}{" "}
            <span className={`font-normal ${outcomeClass(a.outcome)}`}>
              · {a.outcomeLabel}
            </span>
          </p>
          <p className="mt-1 text-zinc-600">
            {new Date(a.at).toLocaleString("en-ZA")}
            {a.adminLabel ? ` · ${a.adminLabel}` : ""}
          </p>
          {a.reason ? (
            <p className="mt-1 text-zinc-700">
              <span className="text-zinc-500">Reason:</span> {a.reason}
            </p>
          ) : null}
          {a.resultCode ? (
            <p className="mt-1 font-mono text-zinc-600">code: {a.resultCode}</p>
          ) : null}
          {(a.bookingStatusBefore || a.bookingStatusAfter) && (
            <p className="mt-1 text-zinc-600">
              Status: {a.bookingStatusBefore ?? "-"} → {a.bookingStatusAfter ?? "-"}
            </p>
          )}
          {a.cleanerId ? (
            <p className="mt-1 truncate font-mono text-zinc-500" title={a.cleanerId}>
              cleaner: {a.cleanerId}
            </p>
          ) : null}
          {a.offerId ? (
            <p className="mt-1 truncate font-mono text-zinc-500" title={a.offerId}>
              offer: {a.offerId}
            </p>
          ) : null}
          {a.cancelledOfferId ? (
            <p
              className="mt-1 truncate font-mono text-zinc-500"
              title={a.cancelledOfferId}
            >
              cancelled offer: {a.cancelledOfferId}
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
