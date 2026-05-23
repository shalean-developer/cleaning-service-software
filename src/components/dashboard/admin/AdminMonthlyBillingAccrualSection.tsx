import type { MonthlyInvoiceAccrualDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoiceAccrualDiagnostics";

type Props = {
  accrual: MonthlyInvoiceAccrualDiagnostics;
};

export function AdminBookingInvoiceAccrualStatus({
  accrued,
  batchId,
  billingMonth,
  amountCents,
  itemStatus,
  batchStatus,
  zohoInvoiceId,
  zohoInvoiceNumber,
}: {
  accrued: boolean;
  batchId: string | null;
  billingMonth: string | null;
  amountCents: number | null;
  itemStatus: string | null;
  batchStatus?: string | null;
  zohoInvoiceId?: string | null;
  zohoInvoiceNumber?: string | null;
}) {
  if (!accrued) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        data-testid="admin-booking-invoice-accrual-not-accrued"
      >
        <p className="font-medium">Invoice accrual: not accrued</p>
        <p className="text-xs">Completed monthly visit not yet in an invoice batch.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
      data-testid="admin-booking-invoice-accrual-accrued"
    >
      <p className="font-medium">Invoice accrual: accrued</p>
      <ul className="mt-1 space-y-0.5 text-xs">
        {billingMonth ? <li>Billing month: {billingMonth}</li> : null}
        {amountCents != null ? (
          <li>
            Amount:{" "}
            {new Intl.NumberFormat("en-ZA", {
              style: "currency",
              currency: "ZAR",
              maximumFractionDigits: 0,
            }).format(amountCents / 100)}
          </li>
        ) : null}
        {batchId ? <li className="font-mono">Batch {batchId.slice(0, 8)}…</li> : null}
        {itemStatus ? <li>Item status: {itemStatus}</li> : null}
        {zohoInvoiceNumber || zohoInvoiceId ? (
          <li className="font-mono">
            Zoho invoice: {zohoInvoiceNumber ?? zohoInvoiceId}
          </li>
        ) : null}
        {batchStatus ? <li>Batch status: {batchStatus}</li> : null}
      </ul>
      <p className="mt-1 text-xs">
        {batchStatus === "paid" || itemStatus === "paid"
          ? "Monthly invoice paid."
          : batchStatus === "generated" || batchStatus === "sent" || batchStatus === "overdue"
            ? "Awaiting invoice payment."
            : zohoInvoiceId || itemStatus === "invoiced"
              ? "Invoiced in Zoho."
              : "Not invoiced in Zoho yet."}
      </p>
    </div>
  );
}

export function AdminMonthlyBillingAccrualSection({ accrual }: Props) {
  return (
    <section aria-label="Invoice accrual diagnostics" className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
        Invoice accrual
      </h2>

      {!accrual.accrualEnabled ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-testid="monthly-billing-accrual-disabled-banner"
        >
          Monthly invoice accrual is disabled.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Accrued items
          </p>
          <p className="mt-1 text-2xl font-semibold">{accrual.totalAccruedItemCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Draft batch accrued total
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {new Intl.NumberFormat("en-ZA", {
              style: "currency",
              currency: "ZAR",
              maximumFractionDigits: 0,
            }).format(accrual.totalAccruedAmountCents / 100)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Ready for generation
          </p>
          <p className="mt-1 text-2xl font-semibold">{accrual.draftBatchesReadyForGeneration}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Completed not accrued
          </p>
          <p className="mt-1 text-2xl font-semibold">{accrual.completedNotAccruedCount}</p>
        </div>
      </div>

      {accrual.alerts.length > 0 ? (
        <ul
          className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm"
          data-testid="monthly-billing-accrual-alerts"
        >
          {accrual.alerts.slice(0, 15).map((alert, index) => (
            <li
              key={`${alert.code}-${alert.bookingId ?? index}`}
              className={
                alert.severity === "error"
                  ? "text-red-800"
                  : alert.severity === "warning"
                    ? "text-amber-900"
                    : "text-zinc-700"
              }
            >
              {alert.message}
              {alert.bookingId ? (
                <span className="ml-1 font-mono text-xs">({alert.bookingId.slice(0, 8)}…)</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
