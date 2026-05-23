"use client";

import type { MonthlyInvoicePaymentSyncDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoicePaymentSyncDiagnostics";

type Props = {
  paymentSync: MonthlyInvoicePaymentSyncDiagnostics;
};

export function AdminMonthlyBillingPaymentSyncSection({ paymentSync }: Props) {
  return (
    <section aria-label="Payment sync diagnostics" className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
        Payment sync
      </h2>

      {!paymentSync.syncEnabled ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-testid="monthly-billing-payment-sync-disabled-banner"
        >
          Monthly invoice payment sync is disabled.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Awaiting payment
          </p>
          <p className="mt-1 text-2xl font-semibold">{paymentSync.generatedAwaitingPayment}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Overdue</p>
          <p className="mt-1 text-2xl font-semibold">{paymentSync.overdueBatchCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Paid this month
          </p>
          <p className="mt-1 text-2xl font-semibold">{paymentSync.paidThisMonthCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Sync failures</p>
          <p className="mt-1 text-2xl font-semibold">{paymentSync.syncFailureCount}</p>
        </div>
      </div>

      {paymentSync.alerts.length > 0 ? (
        <ul className="space-y-2" data-testid="monthly-billing-payment-sync-alerts">
          {paymentSync.alerts.map((alert, index) => (
            <li
              key={`${alert.code}-${alert.batchId ?? index}`}
              className={`rounded-lg border px-3 py-2 text-sm ${
                alert.severity === "error"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : alert.severity === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-zinc-200 bg-zinc-50 text-zinc-800"
              }`}
            >
              {alert.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
