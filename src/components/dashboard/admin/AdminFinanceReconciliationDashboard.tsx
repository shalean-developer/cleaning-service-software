import Link from "next/link";
import { formatInvoiceAmount } from "@/features/zoho-invoice-payments/server/formatInvoiceAmount";
import type {
  FinanceReconciliationItem,
  FinanceReconciliationResult,
  FinanceReconciliationSource,
  FinanceReconciliationStatus,
} from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import { buildFinanceReconciliationExportHref } from "@/features/finance-reconciliation/server/parseFinanceReconciliationQueryParams";

type Props = {
  data: FinanceReconciliationResult;
  filters: {
    from?: string;
    to?: string;
    source: FinanceReconciliationSource | "all";
    status: FinanceReconciliationStatus | "all";
  };
};

function statusTone(status: FinanceReconciliationStatus): string {
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

function sourceLabel(source: FinanceReconciliationSource): string {
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

function buildFilterHref(
  filters: Props["filters"],
  patch: Partial<Props["filters"]>,
): string {
  const params = new URLSearchParams();
  const merged = { ...filters, ...patch };
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  if (merged.source && merged.source !== "all") params.set("source", merged.source);
  if (merged.status && merged.status !== "all") params.set("status", merged.status);
  const qs = params.toString();
  return qs
    ? `/admin/operations/finance-reconciliation?${qs}`
    : "/admin/operations/finance-reconciliation";
}

function ReconciliationRow({ item }: { item: FinanceReconciliationItem }) {
  return (
    <tr className="border-b border-zinc-100 align-top">
      <td className="px-2 py-2 text-xs">{sourceLabel(item.source)}</td>
      <td className="px-2 py-2 font-mono text-xs">{item.reference}</td>
      <td className="px-2 py-2 text-xs">{item.customerLabel ?? "—"}</td>
      <td className="px-2 py-2 tabular-nums">
        {formatInvoiceAmount(item.amountCents, item.currency)}
      </td>
      <td className="px-2 py-2 text-xs">{item.shaleanStatus}</td>
      <td className="px-2 py-2 text-xs">{item.paystackStatus ?? "—"}</td>
      <td className="px-2 py-2 text-xs">{item.zohoStatus ?? "—"}</td>
      <td className="px-2 py-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusTone(item.reconciliationStatus)}`}
        >
          {item.reconciliationStatus}
        </span>
      </td>
      <td className="max-w-xs px-2 py-2 text-xs text-zinc-600">{item.issueLabel ?? "—"}</td>
      <td className="max-w-xs px-2 py-2 text-xs text-zinc-600">{item.actionHint ?? "—"}</td>
      <td className="px-2 py-2 text-xs text-zinc-600">
        <div>{new Date(item.createdAt).toLocaleString("en-ZA")}</div>
        {item.paidAt ? (
          <div className="text-zinc-500">
            Paid {new Date(item.paidAt).toLocaleString("en-ZA")}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

export function AdminFinanceReconciliationDashboard({ data, filters }: Props) {
  const { summary, items } = data;
  const exportHref = buildFinanceReconciliationExportHref(filters);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Finance reconciliation</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Read-only view comparing Shalean, Paystack, and Zoho records.
            </p>
          </div>
          <a
            href={exportHref}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Export CSV
          </a>
        </div>

        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">From</span>
            <input
              type="date"
              name="from"
              defaultValue={filters.from?.slice(0, 10)}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">To</span>
            <input
              type="date"
              name="to"
              defaultValue={filters.to?.slice(0, 10)}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Source</span>
            <select
              name="source"
              defaultValue={filters.source}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="booking">Booking payments</option>
              <option value="zoho_invoice">Zoho invoice checkout</option>
              <option value="saved_card_invoice">Saved-card charges</option>
              <option value="refund_credit">Refunds / credit notes</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Status</span>
            <select
              name="status"
              defaultValue={filters.status}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="matched">Matched</option>
              <option value="pending">Pending</option>
              <option value="mismatch">Mismatch</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Apply filters
            </button>
          </div>
        </form>
      </section>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: "Matched",
            count: summary.matchedCount,
            amount: summary.matchedAmountCents,
            tone: "text-emerald-700",
          },
          {
            label: "Pending",
            count: summary.pendingCount,
            amount: summary.pendingAmountCents,
            tone: "text-amber-700",
          },
          {
            label: "Mismatch",
            count: summary.mismatchCount,
            amount: summary.mismatchAmountCents,
            tone: "text-orange-700",
          },
          {
            label: "Failed",
            count: summary.failedCount,
            amount: summary.failedAmountCents,
            tone: "text-red-700",
          },
          {
            label: "Total",
            count:
              summary.matchedCount +
              summary.pendingCount +
              summary.mismatchCount +
              summary.failedCount,
            amount: summary.totalAmountCents,
            tone: "text-zinc-900",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm"
          >
            <dt className="text-xs font-medium text-zinc-500">{card.label}</dt>
            <dd className={`text-lg font-semibold tabular-nums ${card.tone}`}>{card.count}</dd>
            <dd className="text-xs tabular-nums text-zinc-600">
              {formatInvoiceAmount(card.amount, "ZAR")}
            </dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
        <p>
          Booking sales synced: <strong>{summary.bookingSalesSyncedCount}</strong> · Manual invoice
          payments reconciled: <strong>{summary.manualInvoicePaymentsReconciledCount}</strong> ·
          Saved-card charges reconciled:{" "}
          <strong>{summary.savedCardChargesReconciledCount}</strong> · Refunds/credits synced:{" "}
          <strong>{summary.refundsCreditsSyncedCount}</strong>
        </p>
        {summary.oldestPendingAt ? (
          <p className="mt-1">
            Oldest pending: {new Date(summary.oldestPendingAt).toLocaleString("en-ZA")}
          </p>
        ) : null}
        {summary.latestFailedAt ? (
          <p className="mt-1">
            Latest failed: {new Date(summary.latestFailedAt).toLocaleString("en-ZA")}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={buildFilterHref(filters, { status: "failed" })}
          className="text-red-700 underline"
        >
          Failed only
        </Link>
        <Link
          href={buildFilterHref(filters, { status: "mismatch" })}
          className="text-orange-700 underline"
        >
          Mismatch only
        </Link>
        <Link
          href={buildFilterHref(filters, { status: "pending" })}
          className="text-amber-700 underline"
        >
          Pending only
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          No reconciliation items match the current filters.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Reference</th>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Shalean</th>
                  <th className="px-2 py-2">Paystack</th>
                  <th className="px-2 py-2">Zoho</th>
                  <th className="px-2 py-2">Reconciliation</th>
                  <th className="px-2 py-2">Issue</th>
                  <th className="px-2 py-2">Action hint</th>
                  <th className="px-2 py-2">Dates</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <ReconciliationRow key={item.id} item={item} />
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
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusTone(item.reconciliationStatus)}`}
                  >
                    {item.reconciliationStatus}
                  </span>
                </div>
                <p className="mt-2 font-semibold tabular-nums">
                  {formatInvoiceAmount(item.amountCents, item.currency)}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-xs text-zinc-600">
                  <div>Shalean: {item.shaleanStatus}</div>
                  <div>Paystack: {item.paystackStatus ?? "—"}</div>
                  <div>Zoho: {item.zohoStatus ?? "—"}</div>
                  <div>Issue: {item.issueLabel ?? "—"}</div>
                </dl>
                {item.actionHint ? (
                  <p className="mt-2 text-xs text-zinc-600">{item.actionHint}</p>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
