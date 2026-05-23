import { formatInvoiceAmount } from "@/features/zoho-invoice-payments/server/formatInvoiceAmount";
import type {
  CorporateStatementFilters,
  CorporateStatementLineItem,
  CorporateStatementResult,
} from "@/features/corporate-statements/server/corporateStatementReadModel";
import { buildCorporateStatementExportHref } from "@/features/corporate-statements/server/parseCorporateStatementQueryParams";
import { AdminCorporateStatementPrintButton } from "./AdminCorporateStatementPrintButton";

type Props = {
  data: CorporateStatementResult | null;
  filters: Partial<CorporateStatementFilters> & { periodType: CorporateStatementFilters["periodType"] };
  hasCustomerIdentifier: boolean;
};

function typeLabel(type: CorporateStatementLineItem["type"]): string {
  switch (type) {
    case "invoice":
      return "Invoice";
    case "payment":
      return "Payment";
    case "saved_card_payment":
      return "Saved-card payment";
    case "refund_credit":
      return "Refund / credit";
  }
}

function formatPeriodRange(from: string, to: string): string {
  const start = new Date(from).toLocaleDateString("en-ZA");
  const end = new Date(to).toLocaleDateString("en-ZA");
  return `${start} – ${end}`;
}

function StatementRow({ item }: { item: CorporateStatementLineItem }) {
  return (
    <tr className="border-b border-zinc-100 align-top">
      <td className="px-2 py-2 text-xs text-zinc-600">
        {new Date(item.date).toLocaleDateString("en-ZA")}
      </td>
      <td className="px-2 py-2 text-xs">{typeLabel(item.type)}</td>
      <td className="px-2 py-2 font-mono text-xs">{item.reference}</td>
      <td className="max-w-xs px-2 py-2 text-xs text-zinc-700">{item.description}</td>
      <td className="px-2 py-2 tabular-nums text-xs">
        {item.debitCents > 0 ? formatInvoiceAmount(item.debitCents, "ZAR") : "—"}
      </td>
      <td className="px-2 py-2 tabular-nums text-xs">
        {item.creditCents > 0 ? formatInvoiceAmount(item.creditCents, "ZAR") : "—"}
      </td>
      <td className="px-2 py-2 text-xs font-medium tabular-nums">
        {formatInvoiceAmount(item.balanceCents, "ZAR")}
      </td>
      <td className="px-2 py-2 text-xs capitalize text-zinc-600">{item.status}</td>
    </tr>
  );
}

export function AdminCorporateStatementsDashboard({
  data,
  filters,
  hasCustomerIdentifier,
}: Props) {
  const exportHref = hasCustomerIdentifier
    ? buildCorporateStatementExportHref({
        customerEmail: filters.customerEmail,
        customerName: filters.customerName,
        zohoCustomerId: filters.zohoCustomerId,
        periodType: filters.periodType,
        from: filters.from ?? "",
        to: filters.to ?? "",
      })
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <h2 className="text-base font-semibold text-zinc-900">Corporate client statement</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Generate read-only monthly statements for corporate / manual invoice clients.
        </p>

        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" method="get">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Customer email</span>
            <input
              type="email"
              name="customerEmail"
              defaultValue={filters.customerEmail}
              placeholder="accounts@company.com"
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Customer name</span>
            <input
              type="text"
              name="customerName"
              defaultValue={filters.customerName}
              placeholder="Company name"
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Zoho customer ID</span>
            <input
              type="text"
              name="zohoCustomerId"
              defaultValue={filters.zohoCustomerId}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Period type</span>
            <select
              name="periodType"
              defaultValue={filters.periodType}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
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
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Generate statement
            </button>
          </div>
        </form>
      </section>

      {data ? (
        <div id="corporate-statement-print" className="space-y-6">
          <header className="hidden print:block">
            <p className="text-lg font-bold text-zinc-900">Shalean Cleaning Services</p>
            <p className="mt-2 text-sm text-zinc-700">Corporate account statement</p>
            <p className="text-sm font-medium text-zinc-900">{data.summary.customerLabel}</p>
            <p className="text-sm text-zinc-600">
              {formatPeriodRange(data.summary.periodStart, data.summary.periodEnd)}
            </p>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div>
              <p className="text-sm font-medium text-zinc-900">{data.summary.customerLabel}</p>
              <p className="text-xs text-zinc-600">
                {formatPeriodRange(data.summary.periodStart, data.summary.periodEnd)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {exportHref ? (
                <a
                  href={exportHref}
                  className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Export CSV
                </a>
              ) : null}
              <AdminCorporateStatementPrintButton />
            </div>
          </div>

          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 print:hidden">
            {data.openingBalanceNote}
          </p>

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Opening balance", amount: data.summary.openingBalanceCents },
              { label: "Invoices / charges", amount: data.summary.invoiceChargesCents },
              { label: "Payments", amount: data.summary.paymentsCents },
              { label: "Credits / refunds", amount: data.summary.refundsCreditsCents },
              { label: "Closing balance", amount: data.summary.closingBalanceCents },
              { label: "Outstanding items", amount: data.summary.outstandingCount, count: true },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm"
              >
                <dt className="text-xs font-medium text-zinc-500">{card.label}</dt>
                <dd className="text-lg font-semibold tabular-nums text-zinc-900">
                  {"count" in card && card.count
                    ? card.amount
                    : formatInvoiceAmount(card.amount, "ZAR")}
                </dd>
              </div>
            ))}
          </dl>

          {data.items.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
              No statement activity for this period.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Reference</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">Debit</th>
                    <th className="px-2 py-2">Credit</th>
                    <th className="px-2 py-2">Balance</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <StatementRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <footer className="hidden pt-6 text-xs text-zinc-500 print:block">
            Statement generated by Shalean Cleaning Services.
          </footer>
        </div>
      ) : hasCustomerIdentifier ? null : (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 print:hidden">
          Enter a customer email, name, or Zoho customer ID and select a period to generate a
          statement.
        </p>
      )}
    </div>
  );
}
