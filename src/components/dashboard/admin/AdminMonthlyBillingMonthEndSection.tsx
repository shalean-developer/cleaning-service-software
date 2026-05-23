"use client";

import type { MonthlyInvoiceBatchListItem } from "@/features/monthly-billing/server/monthlyInvoiceBatchReadModel";
import { AdminMonthlyBillingBatchGenerateAction } from "./AdminMonthlyBillingBatchGenerateAction";
import { AdminMonthlyBillingBatchSyncAction } from "./AdminMonthlyBillingBatchSyncAction";
import { AdminMonthlyBillingBatchSendAction } from "./AdminMonthlyBillingBatchSendAction";
import { AdminMonthlyBillingBatchReminderAction } from "./AdminMonthlyBillingBatchReminderAction";
import { AdminMonthlyBillingBatchMarkOverdueAction } from "./AdminMonthlyBillingBatchMarkOverdueAction";

type Props = {
  batches: MonthlyInvoiceBatchListItem[];
  generationEnabled: boolean;
  paymentSyncEnabled: boolean;
  operationsEnabled: boolean;
};

function formatZar(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function BatchSection({
  title,
  testId,
  rows,
  generationEnabled,
  paymentSyncEnabled,
  operationsEnabled,
}: {
  title: string;
  testId: string;
  rows: MonthlyInvoiceBatchListItem[];
  generationEnabled: boolean;
  paymentSyncEnabled: boolean;
  operationsEnabled: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <section aria-label={title} className="space-y-2" data-testid={testId}>
      <h3 className="text-sm font-semibold text-zinc-800">
        {title} ({rows.length})
      </h3>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-zinc-600">Customer</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-600">Month</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-600">Status</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-600">Total</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-600">Invoice</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.batchId}>
                <td className="px-3 py-2">{row.customerName ?? row.customerId.slice(0, 8)}</td>
                <td className="px-3 py-2">{row.billingMonth}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2 tabular-nums">{formatZar(row.totalCents)}</td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                  {row.zohoInvoiceNumber ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="space-y-2">
                    <AdminMonthlyBillingBatchGenerateAction
                      row={row}
                      generationEnabled={generationEnabled}
                    />
                    <AdminMonthlyBillingBatchSendAction
                      row={row}
                      operationsEnabled={operationsEnabled}
                    />
                    <AdminMonthlyBillingBatchReminderAction
                      row={row}
                      operationsEnabled={operationsEnabled}
                    />
                    <AdminMonthlyBillingBatchMarkOverdueAction
                      row={row}
                      operationsEnabled={operationsEnabled}
                    />
                    <AdminMonthlyBillingBatchSyncAction
                      row={row}
                      syncEnabled={paymentSyncEnabled}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdminMonthlyBillingMonthEndSection({
  batches,
  generationEnabled,
  paymentSyncEnabled,
  operationsEnabled,
}: Props) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const readyToGenerate = batches.filter((row) => row.status === "draft" && row.itemCount > 0);
  const generatedNotSent = batches.filter((row) => row.status === "generated");
  const sentAwaitingPayment = batches.filter((row) => row.status === "sent");
  const overdue = batches.filter((row) => row.status === "overdue");
  const paidThisMonth = batches.filter((row) => {
    if (row.status !== "paid" || !row.paidAt) return false;
    return new Date(row.paidAt).getTime() >= monthStart.getTime();
  });
  const syncFailures = batches.filter((row) => Boolean(row.paymentSyncLastError));

  return (
    <section aria-label="Month-end batch review" className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
        Month-end batch review
      </h2>
      <BatchSection
        title="Ready to generate"
        testId="monthly-billing-ready-to-generate-section"
        rows={readyToGenerate}
        generationEnabled={generationEnabled}
        paymentSyncEnabled={paymentSyncEnabled}
        operationsEnabled={operationsEnabled}
      />
      <BatchSection
        title="Generated not sent"
        testId="monthly-billing-generated-not-sent-section"
        rows={generatedNotSent}
        generationEnabled={generationEnabled}
        paymentSyncEnabled={paymentSyncEnabled}
        operationsEnabled={operationsEnabled}
      />
      <BatchSection
        title="Sent awaiting payment"
        testId="monthly-billing-sent-awaiting-payment-section"
        rows={sentAwaitingPayment}
        generationEnabled={generationEnabled}
        paymentSyncEnabled={paymentSyncEnabled}
        operationsEnabled={operationsEnabled}
      />
      <BatchSection
        title="Overdue"
        testId="monthly-billing-overdue-section"
        rows={overdue}
        generationEnabled={generationEnabled}
        paymentSyncEnabled={paymentSyncEnabled}
        operationsEnabled={operationsEnabled}
      />
      <BatchSection
        title="Paid this month"
        testId="monthly-billing-paid-this-month-section"
        rows={paidThisMonth}
        generationEnabled={generationEnabled}
        paymentSyncEnabled={paymentSyncEnabled}
        operationsEnabled={operationsEnabled}
      />
      <BatchSection
        title="Sync failures"
        testId="monthly-billing-sync-failures-section"
        rows={syncFailures}
        generationEnabled={generationEnabled}
        paymentSyncEnabled={paymentSyncEnabled}
        operationsEnabled={operationsEnabled}
      />
    </section>
  );
}
