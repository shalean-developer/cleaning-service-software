import type { MonthlyInvoiceGenerationDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoiceGenerationDiagnostics";

type Props = {
  generation: MonthlyInvoiceGenerationDiagnostics;
};

export function AdminMonthlyBillingGenerationSection({ generation }: Props) {
  return (
    <section aria-label="Zoho invoice generation diagnostics" className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
        Zoho invoice generation
      </h2>

      {!generation.generationEnabled ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-testid="monthly-billing-generation-disabled-banner"
        >
          Zoho invoice generation is disabled.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Ready for generation
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {generation.draftBatchesReadyForGeneration}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Generated (unpaid)
          </p>
          <p className="mt-1 text-2xl font-semibold">{generation.generatedUnpaidBatchCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Generation failures
          </p>
          <p className="mt-1 text-2xl font-semibold">{generation.generationFailureCount}</p>
        </div>
      </div>

      {generation.alerts.length > 0 ? (
        <ul
          className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm"
          data-testid="monthly-billing-generation-alerts"
        >
          {generation.alerts.slice(0, 15).map((alert, index) => (
            <li
              key={`${alert.code}-${alert.batchId ?? index}`}
              className={
                alert.severity === "error"
                  ? "text-red-800"
                  : alert.severity === "warning"
                    ? "text-amber-900"
                    : "text-zinc-700"
              }
            >
              {alert.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
