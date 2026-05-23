import { formatInvoiceAmount } from "@/features/zoho-invoice-payments/server/formatInvoiceAmount";
import type {
  TaxReportFilters,
  TaxReportLineItem,
  TaxReportResult,
  TaxReportSource,
  TaxReportSourceBreakdown,
} from "@/features/tax-reports/server/taxReportReadModel";
import {
  buildTaxReportDetailExportHref,
  buildTaxReportSummaryExportHref,
} from "@/features/tax-reports/server/parseTaxReportQueryParams";

type Props = {
  data: TaxReportResult;
  filters: TaxReportFilters;
};

const ACCOUNTANT_DISCLAIMER =
  "This report is for internal accounting support and should be reviewed by your accountant before tax filing. It is not a SARS-ready filing submission.";

function sourceLabel(source: TaxReportSource): string {
  switch (source) {
    case "booking":
      return "Booking payments";
    case "zoho_invoice":
      return "Zoho invoice checkout";
    case "saved_card_invoice":
      return "Saved-card charges";
    case "refund_credit":
      return "Refunds / credit notes";
  }
}

function formatPeriodRange(filters: TaxReportFilters): string {
  const start = new Date(filters.from).toLocaleDateString("en-ZA");
  const end = new Date(filters.to).toLocaleDateString("en-ZA");
  return `${start} – ${end}`;
}

function TaxRow({ item, vatRegistered }: { item: TaxReportLineItem; vatRegistered: boolean }) {
  return (
    <tr className="border-b border-zinc-100 align-top">
      <td className="px-2 py-2 text-xs">{sourceLabel(item.source)}</td>
      <td className="px-2 py-2 font-mono text-xs">{item.reference}</td>
      <td className="px-2 py-2 tabular-nums">
        {formatInvoiceAmount(item.grossAmountCents, item.currency)}
      </td>
      <td className="px-2 py-2 tabular-nums">
        {vatRegistered
          ? formatInvoiceAmount(item.estimatedVatCents, item.currency)
          : "—"}
      </td>
      <td className="px-2 py-2 tabular-nums">
        {vatRegistered
          ? formatInvoiceAmount(item.netExcludingVatCents, item.currency)
          : formatInvoiceAmount(item.signedAmountCents, item.currency)}
      </td>
      <td className="px-2 py-2 text-xs text-zinc-600">
        {item.paidAt ? new Date(item.paidAt).toLocaleString("en-ZA") : "—"}
      </td>
    </tr>
  );
}

function BreakdownRow({ row }: { row: TaxReportSourceBreakdown }) {
  return (
    <tr className="border-b border-zinc-100 align-top">
      <td className="px-2 py-2 text-xs">{sourceLabel(row.source)}</td>
      <td className="px-2 py-2 tabular-nums">{formatInvoiceAmount(row.grossSalesCents, "ZAR")}</td>
      <td className="px-2 py-2 tabular-nums">
        {row.refundsCreditsCents > 0
          ? formatInvoiceAmount(row.refundsCreditsCents, "ZAR")
          : "—"}
      </td>
      <td className="px-2 py-2 tabular-nums">{formatInvoiceAmount(row.netSalesCents, "ZAR")}</td>
      <td className="px-2 py-2 tabular-nums">{formatInvoiceAmount(row.estimatedVatCents, "ZAR")}</td>
      <td className="px-2 py-2 tabular-nums">{row.count}</td>
    </tr>
  );
}

export function AdminTaxReportsDashboard({ data, filters }: Props) {
  const { summary, items, sourceBreakdown, hasUnresolvedWarning } = data;
  const detailExportHref = buildTaxReportDetailExportHref(filters);
  const summaryExportHref = buildTaxReportSummaryExportHref(filters);
  const periodLabel = formatPeriodRange(filters);

  const summaryCards = [
    { label: "Gross sales", amount: summary.grossSalesCents, credit: false },
    { label: "Refunds / credits", amount: summary.refundsCreditsCents, credit: true },
    { label: "Net sales", amount: summary.netSalesAfterCreditsCents, credit: false },
    {
      label: "Estimated output VAT",
      amount: summary.estimatedOutputVatCents,
      credit: false,
      na: !summary.vatRegistered,
    },
    {
      label: "Net excluding VAT",
      amount: summary.netExcludingVatCents,
      credit: false,
      na: !summary.vatRegistered,
    },
    { label: "Transactions", amount: summary.transactionCount, credit: false, count: true },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">VAT / tax reports</h2>
            <p className="mt-1 text-sm text-zinc-600">Period: {periodLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={detailExportHref}
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Download tax detail CSV
            </a>
            <a
              href={summaryExportHref}
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Download tax summary CSV
            </a>
          </div>
        </div>

        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Period type</span>
            <select
              name="periodType"
              defaultValue={filters.periodType}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">From</span>
            <input
              type="date"
              name="from"
              defaultValue={filters.from.slice(0, 10)}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">To</span>
            <input
              type="date"
              name="to"
              defaultValue={filters.to.slice(0, 10)}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Source</span>
            <select
              name="source"
              defaultValue={filters.source ?? "all"}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="booking">Booking payments</option>
              <option value="zoho_invoice">Zoho invoice checkout</option>
              <option value="saved_card_invoice">Saved-card charges</option>
              <option value="refund_credit">Refunds / credit notes</option>
            </select>
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              type="checkbox"
              name="includeUnresolved"
              value="true"
              defaultChecked={filters.includeUnresolved}
              className="rounded border-zinc-300"
            />
            <span className="pb-2 text-xs text-zinc-600">Include unresolved items</span>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Apply filters
            </button>
          </div>
        </form>
      </section>

      {summary.vatRegistered ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <p className="font-semibold">VAT reporting is enabled at {summary.vatRate}%.</p>
          <p className="mt-1 text-blue-900">
            Output VAT is estimated using the inclusive VAT formula on matched sales and credits.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
          <p className="font-semibold">VAT not enabled</p>
          <p className="mt-1">
            VAT reporting is not enabled. This report shows sales totals only. Set{" "}
            <code className="rounded bg-zinc-200 px-1 text-xs">SHALEAN_VAT_REGISTERED=true</code> to
            enable VAT columns.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p>{ACCOUNTANT_DISCLAIMER}</p>
      </div>

      {hasUnresolvedWarning ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
          <p className="font-semibold">Unresolved items included</p>
          <p className="mt-1">
            This report includes pending, failed, or mismatched items. Review finance reconciliation
            before using figures for tax filing.
          </p>
        </div>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm"
          >
            <dt className="text-xs font-medium text-zinc-500">{card.label}</dt>
            <dd className="text-lg font-semibold tabular-nums text-zinc-900">
              {"count" in card && card.count
                ? card.amount
                : card.na
                  ? "N/A"
                  : `${card.credit && card.amount > 0 ? "−" : ""}${formatInvoiceAmount(card.amount, "ZAR")}`}
            </dd>
          </div>
        ))}
      </dl>

      {sourceBreakdown.length > 0 ? (
        <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-900">Source breakdown</h3>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Gross sales</th>
                <th className="px-2 py-2">Refunds / credits</th>
                <th className="px-2 py-2">Net sales</th>
                <th className="px-2 py-2">Est. VAT</th>
                <th className="px-2 py-2">Count</th>
              </tr>
            </thead>
            <tbody>
              {sourceBreakdown.map((row) => (
                <BreakdownRow key={row.source} row={row} />
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          No matched transactions match the current period and filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-900">Transaction detail</h3>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Reference</th>
                <th className="px-2 py-2">Gross</th>
                <th className="px-2 py-2">VAT</th>
                <th className="px-2 py-2">Net ex VAT</th>
                <th className="px-2 py-2">Paid</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <TaxRow key={item.id} item={item} vatRegistered={summary.vatRegistered} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
