import "server-only";

import { formatCsvRow } from "@/features/dashboards/server/adminBookingsExport";
import type { FinanceAnalyticsResult } from "./financeAnalyticsTypes";

export const FINANCE_ANALYTICS_SUMMARY_CSV_HEADERS = [
  "period_start",
  "period_end",
  "gross_revenue_cents",
  "refunds_credits_cents",
  "net_revenue_cents",
  "cleaner_payouts_cents",
  "estimated_gross_profit_cents",
  "estimated_gross_margin_percent",
  "total_bookings",
  "paid_bookings",
  "repeat_customer_rate_percent",
  "average_booking_value_cents",
  "failed_payment_rate_percent",
] as const;

export const FINANCE_ANALYTICS_REVENUE_TREND_CSV_HEADERS = [
  "period",
  "gross_revenue_cents",
  "net_revenue_cents",
  "refunds_credits_cents",
  "booking_count",
  "saved_card_charges_cents",
  "corporate_revenue_cents",
  "residential_revenue_cents",
] as const;

export const FINANCE_ANALYTICS_PROFITABILITY_CSV_HEADERS = [
  "service_type",
  "service_label",
  "revenue_cents",
  "estimated_payout_cents",
  "estimated_margin_percent",
] as const;

export const FINANCE_ANALYTICS_OPERATIONAL_CSV_HEADERS = [
  "metric",
  "value",
] as const;

const FORBIDDEN_CSV_SUBSTRINGS = [
  "authorization_code",
  "access_code",
  "authorization_url",
  "refresh_token",
  "metadata",
  "@",
] as const;

function assertSafeCsv(csv: string): void {
  const lower = csv.toLowerCase();
  for (const forbidden of FORBIDDEN_CSV_SUBSTRINGS) {
    if (lower.includes(forbidden)) {
      throw new Error(`Export contains forbidden field: ${forbidden}`);
    }
  }
}

export function financeAnalyticsSummaryToCsv(
  data: FinanceAnalyticsResult,
  periodStart: string,
  periodEnd: string,
): string {
  const { executiveSummary } = data;
  const row = formatCsvRow([
    periodStart,
    periodEnd,
    String(executiveSummary.grossRevenueCents),
    String(executiveSummary.refundsCreditsCents),
    String(executiveSummary.netRevenueCents),
    String(executiveSummary.cleanerPayoutsCents),
    String(executiveSummary.estimatedGrossProfitCents),
    String(executiveSummary.estimatedGrossMarginPercent),
    String(executiveSummary.totalBookings),
    String(executiveSummary.paidBookings),
    String(executiveSummary.repeatCustomerRatePercent),
    String(executiveSummary.averageBookingValueCents),
    String(executiveSummary.failedPaymentRatePercent),
  ]);

  const csv = [formatCsvRow([...FINANCE_ANALYTICS_SUMMARY_CSV_HEADERS]), row].join("\n");
  assertSafeCsv(csv);
  return csv;
}

export function financeAnalyticsRevenueTrendsToCsv(data: FinanceAnalyticsResult): string {
  const rows = data.revenueTrends.map((point) =>
    formatCsvRow([
      point.period,
      String(point.grossRevenueCents),
      String(point.netRevenueCents),
      String(point.refundsCreditsCents),
      String(point.bookingCount),
      String(point.savedCardChargesCents),
      String(point.corporateRevenueCents),
      String(point.residentialRevenueCents),
    ]),
  );

  const csv = [formatCsvRow([...FINANCE_ANALYTICS_REVENUE_TREND_CSV_HEADERS]), ...rows].join(
    "\n",
  );
  assertSafeCsv(csv);
  return csv;
}

export function financeAnalyticsProfitabilityToCsv(data: FinanceAnalyticsResult): string {
  const rows = data.profitability.revenueByServiceType.map((row) =>
    formatCsvRow([
      row.serviceType,
      row.serviceLabel,
      String(row.revenueCents),
      String(row.estimatedPayoutCents),
      row.estimatedMarginPercent != null ? String(row.estimatedMarginPercent) : "",
    ]),
  );

  const csv = [formatCsvRow([...FINANCE_ANALYTICS_PROFITABILITY_CSV_HEADERS]), ...rows].join(
    "\n",
  );
  assertSafeCsv(csv);
  return csv;
}

export function financeAnalyticsOperationalToCsv(data: FinanceAnalyticsResult): string {
  const { operationalHealth } = data;
  const metrics: Array<[string, string]> = [
    ["failed_payment_count", String(operationalHealth.failedPaymentCount)],
    ["failed_payment_rate_percent", String(operationalHealth.failedPaymentRatePercent)],
    ["refund_rate_percent", String(operationalHealth.refundRatePercent)],
    [
      "reconciliation_failure_count",
      String(operationalHealth.reconciliationFailureCount),
    ],
    ["stale_pending_finance_items", String(operationalHealth.stalePendingFinanceItems)],
    [
      "saved_card_charge_success_rate_percent",
      String(operationalHealth.savedCardChargeSuccessRatePercent),
    ],
    ["zoho_sync_matched", String(operationalHealth.zohoSyncHealth.matched)],
    ["zoho_sync_pending", String(operationalHealth.zohoSyncHealth.pending)],
    ["zoho_sync_failed", String(operationalHealth.zohoSyncHealth.failed)],
    ["refund_credit_sync_matched", String(operationalHealth.refundCreditSyncHealth.matched)],
    ["refund_credit_sync_pending", String(operationalHealth.refundCreditSyncHealth.pending)],
    ["refund_credit_sync_failed", String(operationalHealth.refundCreditSyncHealth.failed)],
  ];

  const rows = metrics.map(([metric, value]) => formatCsvRow([metric, value]));
  const csv = [formatCsvRow([...FINANCE_ANALYTICS_OPERATIONAL_CSV_HEADERS]), ...rows].join("\n");
  assertSafeCsv(csv);
  return csv;
}

export function buildFinanceAnalyticsExportFilename(section: string): string {
  const ts = new Date().toISOString().slice(0, 10);
  return `finance-analytics-${section}-${ts}.csv`;
}

export type FinanceAnalyticsExportSection =
  | "summary"
  | "revenue-trends"
  | "profitability"
  | "operational";

export function financeAnalyticsSectionToCsv(
  data: FinanceAnalyticsResult,
  section: FinanceAnalyticsExportSection,
  periodStart: string,
  periodEnd: string,
): string {
  switch (section) {
    case "summary":
      return financeAnalyticsSummaryToCsv(data, periodStart, periodEnd);
    case "revenue-trends":
      return financeAnalyticsRevenueTrendsToCsv(data);
    case "profitability":
      return financeAnalyticsProfitabilityToCsv(data);
    case "operational":
      return financeAnalyticsOperationalToCsv(data);
  }
}
