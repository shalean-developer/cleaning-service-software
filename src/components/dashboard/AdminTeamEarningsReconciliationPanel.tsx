import type { AdminTeamEarningsReconciliation } from "@/features/dashboards/server/types";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";

type Props = {
  reconciliation: AdminTeamEarningsReconciliation;
};

function statusLabel(status: AdminTeamEarningsReconciliation["status"]): string {
  switch (status) {
    case "ok":
      return "Reconciled";
    case "blocked":
      return "Blocked";
    case "warnings":
      return "Warnings";
    default:
      return "Legacy (team earnings off)";
  }
}

function statusTone(status: AdminTeamEarningsReconciliation["status"]): string {
  switch (status) {
    case "ok":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "blocked":
      return "bg-red-50 text-red-800 ring-red-200";
    case "warnings":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    default:
      return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  }
}

export function AdminTeamEarningsReconciliationPanel({ reconciliation }: Props) {
  if (!reconciliation.enabled) {
    return null;
  }

  const { blockingIssues, warnings } = reconciliation;

  return (
    <section className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Team earnings reconciliation
        </h4>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusTone(reconciliation.status)}`}
        >
          {statusLabel(reconciliation.status)}
        </span>
      </div>
      <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Expected pool</dt>
          <dd className="font-medium tabular-nums text-zinc-900">
            {reconciliation.totalPoolCents != null
              ? formatZar(reconciliation.totalPoolCents)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Per-cleaner share</dt>
          <dd className="font-medium tabular-nums text-zinc-900">
            {reconciliation.expectedShareCents != null
              ? formatZar(reconciliation.expectedShareCents)
              : "—"}
            {reconciliation.splitPolicy ? (
              <span className="ml-1 text-xs font-normal text-zinc-500">
                ({reconciliation.splitPolicy}, {reconciliation.expectedParticipantCount}{" "}
                participants)
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Recorded total</dt>
          <dd className="font-medium tabular-nums text-zinc-900">
            {formatZar(reconciliation.recordedPayoutCents)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Payout-ready</dt>
          <dd className="font-medium text-zinc-900">
            {reconciliation.canMarkPayoutReady ? "Allowed" : "Blocked until resolved"}
          </dd>
        </div>
      </dl>
      {blockingIssues.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-zinc-200 pt-2 text-sm text-red-800">
          {blockingIssues.map((issue) => (
            <li key={issue.code}>
              <span className="font-medium">{issue.code}:</span> {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-amber-900">
          {warnings.map((issue) => (
            <li key={issue.code}>
              <span className="font-medium">{issue.code}:</span> {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
