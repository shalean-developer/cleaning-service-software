import type { ZohoPaymentGovernanceMetrics } from "@/features/zoho-invoice-payments/server/loadZohoPaymentGovernance";

type Props = {
  metrics: ZohoPaymentGovernanceMetrics;
};

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

export function AdminZohoDailyPaymentChecks({ metrics }: Props) {
  const hasData =
    metrics.reconcileFailedCount > 0 ||
    metrics.reconcilePendingCount > 0 ||
    metrics.failedAdminCardCharges > 0 ||
    metrics.failedInvoicePayments > 0 ||
    metrics.revokedMethodAuditCount > 0 ||
    metrics.lastCronRun != null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Daily payment checks</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Read-only operational counts. Review the runbook when anything is non-zero.
      </p>

      {!hasData ? (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
          No payment issues recorded yet. Continue monitoring reconciliation and admin charges
          after go-live.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Reconciliation failed" value={metrics.reconcileFailedCount} />
          <MetricCard label="Reconciliation pending" value={metrics.reconcilePendingCount} />
          <MetricCard label="Failed admin card charges" value={metrics.failedAdminCardCharges} />
          <MetricCard label="Failed invoice payments" value={metrics.failedInvoicePayments} />
          <MetricCard label="Revoked methods (audit)" value={metrics.revokedMethodAuditCount} />
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-600">
        Runbook:{" "}
        <a
          href="/docs/payments/zoho-invoice-payments.md"
          className="font-medium text-zinc-800 underline"
        >
          docs/payments/zoho-invoice-payments.md
        </a>{" "}
        (Phase 10 emergency disable and monitoring).
      </p>
    </section>
  );
}
