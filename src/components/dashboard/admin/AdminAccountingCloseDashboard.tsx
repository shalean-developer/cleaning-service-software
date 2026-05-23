import Link from "next/link";
import { formatInvoiceAmount } from "@/features/zoho-invoice-payments/server/formatInvoiceAmount";
import type {
  AccountingCloseFilters,
  AccountingCloseLineItem,
  AccountingCloseResult,
  AccountingCloseSource,
} from "@/features/accounting-close/server/accountingCloseReadModel";
import {
  buildAccountingCloseDetailExportHref,
  buildAccountingCloseSummaryExportHref,
} from "@/features/accounting-close/server/parseAccountingCloseQueryParams";

type Props = {
  data: AccountingCloseResult;
  filters: AccountingCloseFilters;
};

function reconciliationTone(status: AccountingCloseLineItem["reconciliationStatus"]): string {
  switch (status) {
    case "matched":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "mismatch":
      return "bg-orange-50 text-orange-800 ring-orange-200";
    case "failed":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-zinc-50 text-zinc-700 ring-zinc-200";
  }
}

function sourceLabel(source: AccountingCloseSource): string {
  switch (source) {
    case "booking":
      return "Booking payment";
    case "zoho_invoice":
      return "Zoho invoice checkout";
    case "saved_card_invoice":
      return "Saved-card charge";
    case "refund_credit":
      return "Refund / credit";
  }
}

function formatPeriodRange(filters: AccountingCloseFilters): string {
  const start = new Date(filters.from).toLocaleDateString("en-ZA");
  const end = new Date(filters.to).toLocaleDateString("en-ZA");
  return `${start} – ${end}`;
}

function CloseRow({ item }: { item: AccountingCloseLineItem }) {
  return (
    <tr className="border-b border-zinc-100 align-top">
      <td className="px-2 py-2 text-xs">{sourceLabel(item.source)}</td>
      <td className="px-2 py-2 font-mono text-xs">{item.reference}</td>
      <td className="px-2 py-2 tabular-nums">
        {formatInvoiceAmount(item.amountCents, item.currency)}
      </td>
      <td
        className={`px-2 py-2 tabular-nums ${item.signedAmountCents < 0 ? "text-red-700" : "text-zinc-900"}`}
      >
        {formatInvoiceAmount(Math.abs(item.signedAmountCents), item.currency)}
        {item.signedAmountCents < 0 ? " (cr)" : ""}
      </td>
      <td className="px-2 py-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${reconciliationTone(item.reconciliationStatus)}`}
        >
          {item.reconciliationStatus}
        </span>
      </td>
      <td className="max-w-xs px-2 py-2 text-xs text-zinc-600">{item.issueCode ?? "—"}</td>
      <td className="px-2 py-2 text-xs text-zinc-600">
        <div>{new Date(item.createdAt).toLocaleString("en-ZA")}</div>
        {item.paidAt ? (
          <div className="text-zinc-500">Paid {new Date(item.paidAt).toLocaleString("en-ZA")}</div>
        ) : null}
        {item.syncedAt ? (
          <div className="text-zinc-500">
            Synced {new Date(item.syncedAt).toLocaleString("en-ZA")}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

export function AdminAccountingCloseDashboard({ data, filters }: Props) {
  const { summary, items } = data;
  const detailExportHref = buildAccountingCloseDetailExportHref(filters);
  const summaryExportHref = buildAccountingCloseSummaryExportHref(filters);
  const periodLabel = formatPeriodRange(filters);

  const summaryCards = [
    { label: "Gross sales", amount: summary.grossSalesCents, tone: "text-zinc-900", credit: false },
    {
      label: "Refunds / credits",
      amount: summary.refundsCreditsCents,
      tone: "text-red-700",
      credit: true,
    },
    { label: "Net sales", amount: summary.netSalesCents, tone: "text-emerald-700", credit: false },
    { label: "Matched", amount: summary.matchedAmountCents, tone: "text-emerald-700", credit: false },
    { label: "Pending", amount: summary.pendingAmountCents, tone: "text-amber-700", credit: false },
    {
      label: "Failed / mismatch",
      amount: summary.failedAmountCents + summary.mismatchAmountCents,
      tone: "text-red-700",
      credit: false,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Accounting close</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Read-only period closing summary for {periodLabel}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={detailExportHref}
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Download detail CSV
            </a>
            <a
              href={summaryExportHref}
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Download summary CSV
            </a>
          </div>
        </div>

        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Period type</span>
            <select
              name="periodType"
              defaultValue={filters.periodType}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
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

      {summary.readyToClose ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">This period is ready to close.</p>
          <p className="mt-1 text-emerald-800">
            All transactions are reconciled and no stale pending items were found.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">This period has unresolved finance issues.</p>
          {summary.blockingIssues.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-amber-900">
              {summary.blockingIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2">
            <Link href="/admin/operations/finance-reconciliation" className="font-medium underline">
              Open finance reconciliation
            </Link>{" "}
            to resolve issues before closing.
          </p>
        </div>
      )}

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm"
          >
            <dt className="text-xs font-medium text-zinc-500">{card.label}</dt>
            <dd className={`text-lg font-semibold tabular-nums ${card.tone}`}>
              {card.credit && card.amount > 0 ? "−" : ""}
              {formatInvoiceAmount(card.amount, "ZAR")}
            </dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
        <p>
          Ready to close: <strong>{summary.readyToClose ? "Yes" : "No"}</strong> · Total
          transactions: <strong>{summary.totalTransactions}</strong> · Paid / matched:{" "}
          <strong>{summary.paidTransactions}</strong> · Failed:{" "}
          <strong>{summary.failedTransactions}</strong> · Refunds / credits:{" "}
          <strong>{summary.refundCreditCount}</strong> · Unresolved:{" "}
          <strong>{summary.unresolvedCount}</strong>
        </p>
      </section>

      {items.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          No transactions match the current period and filters.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Reference</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Signed amount</th>
                  <th className="px-2 py-2">Reconciliation</th>
                  <th className="px-2 py-2">Issue</th>
                  <th className="px-2 py-2">Dates</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <CloseRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900">{sourceLabel(item.source)}</p>
                    <p className="font-mono text-xs text-zinc-600">{item.reference}</p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${reconciliationTone(item.reconciliationStatus)}`}
                  >
                    {item.reconciliationStatus}
                  </span>
                </div>
                <p className="mt-2 font-semibold tabular-nums">
                  {formatInvoiceAmount(item.amountCents, item.currency)}
                  {item.signedAmountCents < 0 ? " (credit)" : ""}
                </p>
                {item.issueCode ? (
                  <p className="mt-1 text-xs text-zinc-600">Issue: {item.issueCode}</p>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
