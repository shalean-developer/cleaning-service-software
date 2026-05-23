import Link from "next/link";
import { formatInvoiceAmount } from "@/features/zoho-invoice-payments/server/formatInvoiceAmount";
import type {
  FinanceAnalyticsFilters,
  FinanceAnalyticsResult,
  RevenueTrendPoint,
  ServiceProfitabilityRow,
} from "@/features/finance-analytics/server/financeAnalyticsTypes";
import { buildFinanceAnalyticsExportHref } from "@/features/finance-analytics/server/parseFinanceAnalyticsQueryParams";

type Props = {
  data: FinanceAnalyticsResult;
  filters: FinanceAnalyticsFilters;
};

const ANALYTICS_DISCLAIMER =
  "Analytics are operational estimates based on Shalean finance records and should be reviewed alongside formal accounting reports.";

function formatPeriodRange(filters: FinanceAnalyticsFilters): string {
  const start = new Date(filters.from).toLocaleDateString("en-ZA");
  const end = new Date(filters.to).toLocaleDateString("en-ZA");
  return `${start} – ${end}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function SummaryCard({
  label,
  value,
  subtext,
  tone = "text-zinc-900",
}: {
  label: string;
  value: string;
  subtext?: string;
  tone?: string;
}) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {subtext ? <p className="mt-1 text-xs text-zinc-500">{subtext}</p> : null}
    </article>
  );
}

function TrendBar({
  label,
  valueCents,
  maxCents,
  tone = "bg-emerald-500",
}: {
  label: string;
  valueCents: number;
  maxCents: number;
  tone?: string;
}) {
  const widthPercent = maxCents > 0 ? Math.round((valueCents / maxCents) * 100) : 0;

  return (
    <div className="space-y-1">
      <TrendBarLabel label={label} valueCents={valueCents} />
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${widthPercent}%` }} />
      </div>
    </div>
  );
}

function TrendBarLabel({ label, valueCents }: { label: string; valueCents: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-medium text-zinc-700">{label}</span>
      <span className="tabular-nums text-zinc-600">{formatInvoiceAmount(valueCents, "ZAR")}</span>
    </div>
  );
}

function RevenueTrendTable({ trends }: { trends: RevenueTrendPoint[] }) {
  if (trends.length === 0) {
    return <p className="text-sm text-zinc-500">No revenue trend data for this period.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-2 py-2">Period</th>
            <th className="px-2 py-2">Gross</th>
            <th className="px-2 py-2">Net</th>
            <th className="px-2 py-2">Refunds</th>
            <th className="px-2 py-2">Bookings</th>
          </tr>
        </thead>
        <tbody>
          {trends.map((point) => (
            <tr key={point.period} className="border-b border-zinc-100">
              <td className="px-2 py-2 font-mono text-xs">{point.period}</td>
              <td className="px-2 py-2 tabular-nums">
                {formatInvoiceAmount(point.grossRevenueCents, "ZAR")}
              </td>
              <td className="px-2 py-2 tabular-nums text-emerald-700">
                {formatInvoiceAmount(point.netRevenueCents, "ZAR")}
              </td>
              <td className="px-2 py-2 tabular-nums text-red-700">
                {formatInvoiceAmount(point.refundsCreditsCents, "ZAR")}
              </td>
              <td className="px-2 py-2 tabular-nums">{point.bookingCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServiceTable({ rows, title }: { rows: ServiceProfitabilityRow[]; title: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No service data for this period.</p>;
  }

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-zinc-800">{title}</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-2 py-2">Service</th>
              <th className="px-2 py-2">Revenue</th>
              <th className="px-2 py-2">Est. payout</th>
              <th className="px-2 py-2">Est. margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.serviceType} className="border-b border-zinc-100">
                <td className="px-2 py-2">{row.serviceLabel}</td>
                <td className="px-2 py-2 tabular-nums">
                  {formatInvoiceAmount(row.revenueCents, "ZAR")}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {formatInvoiceAmount(row.estimatedPayoutCents, "ZAR")}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {row.estimatedMarginPercent != null
                    ? formatPercent(row.estimatedMarginPercent)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminFinanceAnalyticsDashboard({ data, filters }: Props) {
  const { executiveSummary, revenueTrends, profitability, customerInsights, operationalHealth } =
    data;
  const periodLabel = formatPeriodRange(filters);
  const maxTrendRevenue = Math.max(...revenueTrends.map((t) => t.grossRevenueCents), 1);
  const maxSegmentRevenue = Math.max(
    customerInsights.corporateVsResidential.corporateCents,
    customerInsights.corporateVsResidential.residentialCents,
    1,
  );

  const summaryExportHref = buildFinanceAnalyticsExportHref(filters, "summary");
  const revenueExportHref = buildFinanceAnalyticsExportHref(filters, "revenue-trends");
  const profitabilityExportHref = buildFinanceAnalyticsExportHref(filters, "profitability");
  const operationalExportHref = buildFinanceAnalyticsExportHref(filters, "operational");

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {ANALYTICS_DISCLAIMER}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Executive summary</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Operational profitability overview for {periodLabel}.
            </p>
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
              <option value="quarterly">Quarterly</option>
              <option value="custom">Custom</option>
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
            <span className="mb-1 block text-xs font-medium text-zinc-500">Trend granularity</span>
            <select
              name="trendGranularity"
              defaultValue={filters.trendGranularity}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Gross revenue"
            value={formatInvoiceAmount(executiveSummary.grossRevenueCents, "ZAR")}
          />
          <SummaryCard
            label="Net revenue"
            value={formatInvoiceAmount(executiveSummary.netRevenueCents, "ZAR")}
            tone="text-emerald-700"
          />
          <SummaryCard
            label="Cleaner payouts"
            value={formatInvoiceAmount(executiveSummary.cleanerPayoutsCents, "ZAR")}
          />
          <SummaryCard
            label="Est. gross profit"
            value={formatInvoiceAmount(executiveSummary.estimatedGrossProfitCents, "ZAR")}
            tone="text-emerald-700"
          />
          <SummaryCard
            label="Gross margin"
            value={formatPercent(executiveSummary.estimatedGrossMarginPercent)}
            subtext="Net revenue minus cleaner payouts"
          />
          <SummaryCard
            label="Average booking value"
            value={formatInvoiceAmount(executiveSummary.averageBookingValueCents, "ZAR")}
            subtext={`${executiveSummary.paidBookings} paid bookings`}
          />
          <SummaryCard
            label="Repeat customer rate"
            value={formatPercent(executiveSummary.repeatCustomerRatePercent)}
            subtext={`${customerInsights.repeatCustomers} of ${customerInsights.totalCustomers} customers`}
          />
          <SummaryCard
            label="Failed payment rate"
            value={formatPercent(executiveSummary.failedPaymentRatePercent)}
            tone={
              executiveSummary.failedPaymentRatePercent > 5 ? "text-red-700" : "text-zinc-900"
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Revenue trends</h3>
        <p className="mt-1 text-sm text-zinc-600">Gross, net, refunds, and booking volume over time.</p>
        <div className="mt-4 space-y-3">
          {revenueTrends.slice(-8).map((point) => (
            <TrendBar
              key={point.period}
              label={point.period}
              valueCents={point.netRevenueCents}
              maxCents={maxTrendRevenue}
            />
          ))}
        </div>
        <div className="mt-4">
          <RevenueTrendTable trends={revenueTrends} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Profitability</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Estimated margins by service — not accounting-grade profit.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <SummaryCard
            label="Payout ratio"
            value={formatPercent(profitability.payoutRatioPercent)}
            subtext="Cleaner payouts vs net revenue"
          />
          <SummaryCard
            label="Est. margin"
            value={formatPercent(profitability.estimatedMarginPercent)}
          />
          <SummaryCard
            label="Corporate vs residential"
            value={formatPercent(customerInsights.corporateVsResidential.corporatePercent)}
            subtext="Corporate share of segment revenue"
          />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ServiceTable rows={profitability.topProfitableServices} title="Top services by margin" />
          <ServiceTable rows={profitability.lowestMarginServices} title="Lowest margin services" />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Customer insights</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <TrendBar
              label="Corporate revenue"
              valueCents={customerInsights.corporateVsResidential.corporateCents}
              maxCents={maxSegmentRevenue}
              tone="bg-indigo-500"
            />
            <TrendBar
              label="Residential revenue"
              valueCents={customerInsights.corporateVsResidential.residentialCents}
              maxCents={maxSegmentRevenue}
              tone="bg-sky-500"
            />
          </div>
          <div className="space-y-2 text-sm text-zinc-700">
            <p>
              Saved-card adoption:{" "}
              <span className="font-semibold">
                {formatPercent(customerInsights.savedCardAdoptionRatePercent)}
              </span>
            </p>
            <p>
              Avg. lifetime revenue:{" "}
              <span className="font-semibold tabular-nums">
                {formatInvoiceAmount(customerInsights.averageLifetimeRevenueCents, "ZAR")}
              </span>
            </p>
            <p>
              Booking checkout: {customerInsights.paymentMethodUsage.bookingCheckout} · Invoice
              checkout: {customerInsights.paymentMethodUsage.invoiceCheckout} · Saved-card:{" "}
              {customerInsights.paymentMethodUsage.savedCard}
            </p>
          </div>
        </div>
        {customerInsights.topCustomersByRevenue.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2">Revenue</th>
                  <th className="px-2 py-2">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {customerInsights.topCustomersByRevenue.map((row) => (
                  <tr key={row.customerLabel} className="border-b border-zinc-100">
                    <td className="px-2 py-2">{row.customerLabel}</td>
                    <td className="px-2 py-2 tabular-nums">
                      {formatInvoiceAmount(row.revenueCents, "ZAR")}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{row.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Operational health</h3>
        <p className="mt-1 text-sm text-zinc-600">Failed payments, sync health, and reconciliation alerts.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Failed payments"
            value={String(operationalHealth.failedPaymentCount)}
            subtext={formatPercent(operationalHealth.failedPaymentRatePercent)}
            tone={operationalHealth.failedPaymentCount > 0 ? "text-red-700" : "text-zinc-900"}
          />
          <SummaryCard
            label="Refund rate"
            value={formatPercent(operationalHealth.refundRatePercent)}
          />
          <SummaryCard
            label="Reconciliation failures"
            value={String(operationalHealth.reconciliationFailureCount)}
            tone={
              operationalHealth.reconciliationFailureCount > 0 ? "text-red-700" : "text-zinc-900"
            }
          />
          <SummaryCard
            label="Stale pending items"
            value={String(operationalHealth.stalePendingFinanceItems)}
            tone={
              operationalHealth.stalePendingFinanceItems > 0 ? "text-amber-700" : "text-zinc-900"
            }
          />
          <SummaryCard
            label="Saved-card success rate"
            value={formatPercent(operationalHealth.savedCardChargeSuccessRatePercent)}
            subtext={`${operationalHealth.savedCardChargeAttempts} attempts`}
          />
          <SummaryCard
            label="Zoho sync (matched)"
            value={String(operationalHealth.zohoSyncHealth.matched)}
            subtext={`${operationalHealth.zohoSyncHealth.pending} pending · ${operationalHealth.zohoSyncHealth.failed} failed`}
          />
          <SummaryCard
            label="Refund sync (matched)"
            value={String(operationalHealth.refundCreditSyncHealth.matched)}
            subtext={`${operationalHealth.refundCreditSyncHealth.pending} pending · ${operationalHealth.refundCreditSyncHealth.failed} failed`}
          />
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          Drill down via{" "}
          <Link href="/admin/operations/finance-reconciliation" className="underline">
            Finance reconciliation
          </Link>
          ,{" "}
          <Link href="/admin/operations/zoho-sales-sync" className="underline">
            Zoho sales sync
          </Link>
          , or{" "}
          <Link href="/admin/operations/zoho-refunds" className="underline">
            Zoho refunds
          </Link>
          .
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Export</h3>
        <p className="mt-1 text-sm text-zinc-600">Download read-only CSV reports for this period.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={summaryExportHref}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Summary CSV
          </a>
          <a
            href={revenueExportHref}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Revenue trends CSV
          </a>
          <a
            href={profitabilityExportHref}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Profitability CSV
          </a>
          <a
            href={operationalExportHref}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Operational health CSV
          </a>
        </div>
      </section>
    </div>
  );
}
