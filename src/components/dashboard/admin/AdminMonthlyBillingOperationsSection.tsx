"use client";

import type { MonthlyInvoiceOperationsDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoiceOperationsDiagnostics";

type Props = {
  operations: MonthlyInvoiceOperationsDiagnostics;
};

const CHECKLIST = [
  "Review accrued items",
  "Generate Zoho invoice",
  "Send invoice",
  "Monitor payment",
  "Send reminders",
  "Sync paid status",
] as const;

export function AdminMonthlyBillingOperationsSection({ operations }: Props) {
  return (
    <section aria-label="Month-end invoice operations" className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
        Month-end operations
      </h2>

      {!operations.operationsEnabled ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-testid="monthly-billing-operations-disabled-banner"
        >
          Monthly invoice operations are disabled.
        </p>
      ) : null}

      <ol
        className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 shadow-sm"
        data-testid="monthly-billing-month-end-checklist"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Month-end checklist
        </p>
        {CHECKLIST.map((step, index) => (
          <li key={step} className="flex gap-2 py-0.5">
            <span className="font-medium text-zinc-500">{index + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Generated not sent"
          value={operations.generatedNotSentCount}
          testId="monthly-billing-generated-not-sent-count"
        />
        <MetricCard
          label="Sent awaiting payment"
          value={operations.sentUnpaidCount}
          testId="monthly-billing-sent-unpaid-count"
        />
        <MetricCard label="Overdue" value={operations.overdueCount} />
        <MetricCard label="Reminders sent" value={operations.remindersSentCount} />
        <MetricCard label="Paid this month" value={operations.invoicesPaidThisMonth} />
        <MetricCard
          label="Avg sent → paid (hrs)"
          value={operations.averageSentToPaidHours ?? "—"}
        />
        <MetricCard label="Sync failures" value={operations.syncFailureCount} />
      </div>

      {operations.alerts.length > 0 ? (
        <ul className="space-y-2" data-testid="monthly-billing-operations-alerts">
          {operations.alerts.map((alert, index) => (
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

function MetricCard({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | number;
  testId?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}
