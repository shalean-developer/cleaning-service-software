import "server-only";

import type { FinanceReconciliationItem } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import type { RevenueTrendGranularity } from "./financeAnalyticsTypes";
import { CORPORATE_SOURCES, RESIDENTIAL_SOURCES, SALES_SOURCES } from "./financeAnalyticsTypes";

export function computeNetRevenue(grossRevenueCents: number, refundsCreditsCents: number): number {
  return grossRevenueCents - refundsCreditsCents;
}

export function computeEstimatedGrossProfit(
  netRevenueCents: number,
  cleanerPayoutsCents: number,
): number {
  return netRevenueCents - cleanerPayoutsCents;
}

export function computeMarginPercent(
  grossProfitCents: number,
  netRevenueCents: number,
): number {
  if (netRevenueCents <= 0) return 0;
  return Math.round((grossProfitCents / netRevenueCents) * 1000) / 10;
}

export function computeRepeatCustomerRate(
  repeatCustomers: number,
  totalCustomers: number,
): number {
  if (totalCustomers <= 0) return 0;
  return Math.round((repeatCustomers / totalCustomers) * 1000) / 10;
}

export function computeAverageBookingValue(
  netRevenueCents: number,
  paidBookings: number,
): number {
  if (paidBookings <= 0) return 0;
  return Math.round(netRevenueCents / paidBookings);
}

export function computeFailedPaymentRate(failedCount: number, totalAttempts: number): number {
  if (totalAttempts <= 0) return 0;
  return Math.round((failedCount / totalAttempts) * 1000) / 10;
}

export function computePayoutRatio(
  cleanerPayoutsCents: number,
  netRevenueCents: number,
): number {
  if (netRevenueCents <= 0) return 0;
  return Math.round((cleanerPayoutsCents / netRevenueCents) * 1000) / 10;
}

export function computeRefundRatePercent(
  refundsCreditsCents: number,
  grossRevenueCents: number,
): number {
  if (grossRevenueCents <= 0) return 0;
  return Math.round((refundsCreditsCents / grossRevenueCents) * 1000) / 10;
}

export function computeSuccessRatePercent(successCount: number, totalAttempts: number): number {
  if (totalAttempts <= 0) return 0;
  return Math.round((successCount / totalAttempts) * 1000) / 10;
}

function startOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() + diff);
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
}

export function bucketPeriodKey(isoDate: string, granularity: RevenueTrendGranularity): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "unknown";

  if (granularity === "daily") {
    return date.toISOString().slice(0, 10);
  }

  if (granularity === "weekly") {
    const weekStart = startOfUtcWeek(date);
    return weekStart.toISOString().slice(0, 10);
  }

  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

export function sumSalesRevenue(items: FinanceReconciliationItem[]): number {
  return items.reduce(
    (sum, item) => (SALES_SOURCES.has(item.source) ? sum + item.amountCents : sum),
    0,
  );
}

export function sumRefunds(items: FinanceReconciliationItem[]): number {
  return items.reduce(
    (sum, item) => (item.source === "refund_credit" ? sum + item.amountCents : sum),
    0,
  );
}

export function sumRevenueBySourceSet(
  items: FinanceReconciliationItem[],
  sources: Set<FinanceReconciliationItem["source"]>,
): number {
  return items.reduce(
    (sum, item) => (sources.has(item.source) ? sum + item.amountCents : sum),
    0,
  );
}

export function countPaidBookings(items: FinanceReconciliationItem[]): number {
  return items.filter(
    (item) => item.source === "booking" && item.reconciliationStatus === "matched",
  ).length;
}

export function countReconciliationFailures(items: FinanceReconciliationItem[]): number {
  return items.filter(
    (item) =>
      item.reconciliationStatus === "failed" || item.reconciliationStatus === "mismatch",
  ).length;
}

export function countStalePendingItems(
  items: FinanceReconciliationItem[],
  staleBeforeIso: string,
): number {
  const staleTs = new Date(staleBeforeIso).getTime();
  return items.filter((item) => {
    if (item.reconciliationStatus !== "pending") return false;
    const ts = new Date(item.createdAt).getTime();
    return !Number.isNaN(staleTs) && ts < staleTs;
  }).length;
}

export function aggregateSyncHealth(
  items: FinanceReconciliationItem[],
  source: FinanceReconciliationItem["source"],
): { matched: number; pending: number; failed: number; mismatch: number } {
  const counts = { matched: 0, pending: 0, failed: 0, mismatch: 0 };
  for (const item of items) {
    if (item.source !== source) continue;
    counts[item.reconciliationStatus] += 1;
  }
  return counts;
}

export function isCorporateRevenueSource(source: FinanceReconciliationItem["source"]): boolean {
  return CORPORATE_SOURCES.has(source);
}

export function isResidentialRevenueSource(source: FinanceReconciliationItem["source"]): boolean {
  return RESIDENTIAL_SOURCES.has(source);
}
