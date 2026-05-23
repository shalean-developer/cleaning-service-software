"use client";

import Link from "next/link";
import type {
  CustomerBillingAccountListItem,
  MonthlyBillingAccountsOverview,
} from "@/features/monthly-billing/server/customerBillingAccountReadModel";
import type { MonthlyInvoiceBatchListItem } from "@/features/monthly-billing/server/monthlyInvoiceBatchReadModel";
import type { MonthlyInvoiceAccrualDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoiceAccrualDiagnostics";
import { AdminMonthlyBillingAccountRowActions } from "./AdminMonthlyBillingAccountRowActions";
import { AdminMonthlyBillingAccrualSection } from "./AdminMonthlyBillingAccrualSection";
import { AdminMonthlyBillingGenerationSection } from "./AdminMonthlyBillingGenerationSection";
import { AdminMonthlyBillingBatchGenerateAction } from "./AdminMonthlyBillingBatchGenerateAction";
import { AdminMonthlyBillingPaymentSyncSection } from "./AdminMonthlyBillingPaymentSyncSection";
import { AdminMonthlyBillingOperationsSection } from "./AdminMonthlyBillingOperationsSection";
import { AdminMonthlyBillingMonthEndSection } from "./AdminMonthlyBillingMonthEndSection";
import { AdminMonthlyBillingBatchSyncAction } from "./AdminMonthlyBillingBatchSyncAction";
import { AdminMonthlyBillingBatchSendAction } from "./AdminMonthlyBillingBatchSendAction";
import { AdminMonthlyBillingBatchReminderAction } from "./AdminMonthlyBillingBatchReminderAction";
import { AdminMonthlyBillingBatchMarkOverdueAction } from "./AdminMonthlyBillingBatchMarkOverdueAction";
import type { MonthlyInvoiceGenerationDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoiceGenerationDiagnostics";
import type { MonthlyInvoicePaymentSyncDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoicePaymentSyncDiagnostics";
import type { MonthlyInvoiceOperationsDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoiceOperationsDiagnostics";

type Props = {
  overview: MonthlyBillingAccountsOverview;
  accounts: CustomerBillingAccountListItem[];
  batches: MonthlyInvoiceBatchListItem[];
  accrual: MonthlyInvoiceAccrualDiagnostics;
  generation: MonthlyInvoiceGenerationDiagnostics;
  paymentSync: MonthlyInvoicePaymentSyncDiagnostics;
  operations: MonthlyInvoiceOperationsDiagnostics;
  setupEnabled: boolean;
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA");
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function AdminMonthlyBillingDashboard({
  overview,
  accounts,
  batches,
  accrual,
  generation,
  paymentSync,
  operations,
  setupEnabled,
  generationEnabled,
  paymentSyncEnabled,
  operationsEnabled,
}: Props) {
  return (
    <div className="space-y-6">
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          setupEnabled
            ? "border-sky-200 bg-sky-50 text-sky-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
        data-testid="monthly-billing-phase-banner"
      >
        {setupEnabled
          ? "Monthly account billing setup is enabled. Eligibility changes are audited and idempotent."
          : "Monthly account billing setup is disabled. This page is read-only until ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED is true."}
      </div>

      <section aria-label="Monthly billing overview">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600">
          Monthly billing overview
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total accounts" value={String(overview.totalAccounts)} />
          <SummaryCard
            label="Monthly enabled"
            value={String(overview.monthlyAccountsEnabled)}
            hint={`Disabled ${overview.monthlyAccountsDisabled}`}
          />
          <SummaryCard
            label="Need Zoho link"
            value={String(overview.accountsNeedingZohoLink)}
          />
          <SummaryCard
            label="Draft monthly bookings"
            value={String(overview.draftMonthlyAccountBookings)}
            hint="Awaiting service authorization"
          />
          <SummaryCard
            label="Service authorized (not invoiced)"
            value={String(overview.serviceAuthorizedNotInvoicedBookings)}
            hint="Authorized for service; no invoice batch yet"
          />
          <SummaryCard
            label="Outstanding amount"
            value={formatZar(overview.outstandingAmountCents)}
            hint={`Draft ${overview.draftBatches} · Generated ${overview.generatedBatches} · Sent ${overview.sentBatches}`}
          />
        </div>
      </section>

      <AdminMonthlyBillingAccrualSection accrual={accrual} />
      <AdminMonthlyBillingGenerationSection generation={generation} />
      <AdminMonthlyBillingPaymentSyncSection paymentSync={paymentSync} />
      <AdminMonthlyBillingOperationsSection operations={operations} />
      <AdminMonthlyBillingMonthEndSection
        batches={batches}
        generationEnabled={generationEnabled}
        paymentSyncEnabled={paymentSyncEnabled}
        operationsEnabled={operationsEnabled}
      />

      <section aria-label="Customer billing accounts">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600">
          Customer billing accounts
        </h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-zinc-600">No billing accounts configured yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table
              className="min-w-full divide-y divide-zinc-200 text-sm"
              data-testid="monthly-billing-accounts-table"
            >
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Customer</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Monthly</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Zoho</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Latest audit</th>
                  {setupEnabled ? (
                    <th className="px-3 py-2 text-left font-medium text-zinc-600">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {accounts.map((row) => (
                  <tr key={row.customerId}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/customers/${row.customerId}`}
                        className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                      >
                        {row.customerName ?? row.customerId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {row.monthlyAccountEnabled ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                      {row.zohoCustomerId ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{row.accountStatusLabel}</td>
                    <td className="px-3 py-2 text-xs text-zinc-600">
                      {row.auditSummary.latestAction ?? "—"}
                      {row.auditSummary.latestAt
                        ? ` · ${formatDate(row.auditSummary.latestAt)}`
                        : ""}
                    </td>
                    {setupEnabled ? (
                      <td className="px-3 py-2">
                        <AdminMonthlyBillingAccountRowActions row={row} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Monthly invoice batches">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600">
          Monthly invoice batches
        </h2>
        {batches.length === 0 ? (
          <p className="text-sm text-zinc-600">No invoice batches yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table
              className="min-w-full divide-y divide-zinc-200 text-sm"
              data-testid="monthly-billing-batches-table"
            >
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Customer</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Month</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Total</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Items</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Readiness</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Zoho invoice</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {batches.map((row) => (
                  <tr key={row.batchId}>
                    <td className="px-3 py-2">{row.customerName ?? row.customerId.slice(0, 8)}</td>
                    <td className="px-3 py-2">{row.billingMonth}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2 tabular-nums">{formatZar(row.totalCents)}</td>
                    <td className="px-3 py-2">{row.itemCount}</td>
                    <td className="px-3 py-2 text-xs text-zinc-700">{row.invoiceReadinessLabel}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                      {row.zohoInvoiceNumber ?? row.zohoInvoiceId ?? "—"}
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
        )}
      </section>
    </div>
  );
}
