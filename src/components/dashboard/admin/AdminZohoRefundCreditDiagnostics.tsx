import type { ZohoRefundCreditDiagnosticsResult } from "@/features/zoho-sales-sync/server/loadZohoRefundCreditDiagnostics";

type Props = {
  diagnostics: ZohoRefundCreditDiagnosticsResult;
};

function statusTone(status: string): string {
  switch (status) {
    case "synced":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "failed":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-zinc-50 text-zinc-700 ring-zinc-200";
  }
}

export function AdminZohoRefundCreditDiagnostics({ diagnostics }: Props) {
  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Zoho refund / credit sync</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Accounting credit notes for refunds and cancellations. Read-only diagnostics — no
          destructive actions.
        </p>
      </div>

      {!diagnostics.enabled ? (
        <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          Zoho refund/credit sync is disabled (ZOHO_REFUND_CREDIT_SYNC_ENABLED=false).
        </p>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 px-3 py-2">
          <dt className="text-xs font-medium text-zinc-500">Pending</dt>
          <dd className="text-lg font-semibold tabular-nums text-zinc-900">
            {diagnostics.summary.pending}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 px-3 py-2">
          <dt className="text-xs font-medium text-zinc-500">Synced</dt>
          <dd className="text-lg font-semibold tabular-nums text-zinc-900">
            {diagnostics.summary.synced}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 px-3 py-2">
          <dt className="text-xs font-medium text-zinc-500">Failed</dt>
          <dd className="text-lg font-semibold tabular-nums text-zinc-900">
            {diagnostics.summary.failed}
          </dd>
        </div>
      </dl>

      {diagnostics.rows.length === 0 ? (
        <p className="text-sm text-zinc-600">No refund/credit sync rows yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Reference</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Reason</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Attempts</th>
                <th className="px-2 py-2">Next retry</th>
                <th className="px-2 py-2">Zoho credit note</th>
                <th className="px-2 py-2">Last error</th>
              </tr>
            </thead>
            <tbody>
              {diagnostics.rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 align-top">
                  <td className="px-2 py-2 font-mono text-xs">{row.sourceType}</td>
                  <td className="px-2 py-2">
                    {row.invoiceNumber ?? row.bookingId?.slice(0, 8) ?? row.sourceId.slice(0, 8)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{row.amountDisplay}</td>
                  <td className="max-w-xs px-2 py-2 text-xs text-zinc-600">{row.reason}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusTone(row.syncStatus)}`}
                    >
                      {row.syncStatus}
                    </span>
                  </td>
                  <td className="px-2 py-2 tabular-nums">{row.syncAttempts}</td>
                  <td className="px-2 py-2 text-xs text-zinc-600">
                    {row.nextSyncAttemptAt
                      ? new Date(row.nextSyncAttemptAt).toLocaleString("en-ZA")
                      : "—"}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{row.zohoCreditNoteId ?? "—"}</td>
                  <td className="max-w-xs px-2 py-2 text-xs text-zinc-600">
                    {row.safeLastError ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
