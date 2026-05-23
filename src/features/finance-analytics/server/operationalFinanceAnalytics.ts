import "server-only";

import type { FinanceReconciliationItem } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import {
  aggregateSyncHealth,
  bucketPeriodKey,
  computeFailedPaymentRate,
  computeRefundRatePercent,
  computeSuccessRatePercent,
  countReconciliationFailures,
  countStalePendingItems,
  sumRefunds,
  sumSalesRevenue,
} from "./financeAnalyticsCalculations";
import type { OperationalFinanceHealth, RevenueTrendGranularity } from "./financeAnalyticsTypes";

type PaymentAttemptSlice = {
  status: string;
  created_at: string;
};

function effectiveItemDate(item: FinanceReconciliationItem): string {
  return item.paidAt ?? item.createdAt;
}

function buildFailedPaymentTrend(
  payments: PaymentAttemptSlice[],
  granularity: RevenueTrendGranularity,
): Array<{ period: string; failedCount: number; totalAttempts: number }> {
  const buckets = new Map<string, { failed: number; total: number }>();

  for (const payment of payments) {
    const period = bucketPeriodKey(payment.created_at, granularity);
    const bucket = buckets.get(period) ?? { failed: 0, total: 0 };
    bucket.total += 1;
    if (payment.status === "failed") bucket.failed += 1;
    buckets.set(period, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, bucket]) => ({
      period,
      failedCount: bucket.failed,
      totalAttempts: bucket.total,
    }));
}

function buildRefundTrend(
  items: FinanceReconciliationItem[],
  granularity: RevenueTrendGranularity,
): Array<{ period: string; refundCents: number; refundCount: number }> {
  const buckets = new Map<string, { cents: number; count: number }>();

  for (const item of items) {
    if (item.source !== "refund_credit") continue;
    const period = bucketPeriodKey(effectiveItemDate(item), granularity);
    const bucket = buckets.get(period) ?? { cents: 0, count: 0 };
    bucket.cents += item.amountCents;
    bucket.count += 1;
    buckets.set(period, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, bucket]) => ({
      period,
      refundCents: bucket.cents,
      refundCount: bucket.count,
    }));
}

export function buildOperationalFinanceAnalytics(input: {
  items: FinanceReconciliationItem[];
  paymentAttempts: PaymentAttemptSlice[];
  trendGranularity: RevenueTrendGranularity;
  stalePendingBeforeIso: string;
}): OperationalFinanceHealth {
  const grossRevenueCents = sumSalesRevenue(input.items);
  const refundsCreditsCents = sumRefunds(input.items);

  const savedCardItems = input.items.filter((i) => i.source === "saved_card_invoice");
  const savedCardSuccess = savedCardItems.filter(
    (i) => i.reconciliationStatus === "matched",
  ).length;
  const savedCardAttempts = savedCardItems.length;

  const failedPaymentCount = input.paymentAttempts.filter((p) => p.status === "failed").length;
  const totalPaymentAttempts = input.paymentAttempts.length;

  const bookingSyncItems = input.items.filter((i) => i.source === "booking");
  const refundItems = input.items.filter((i) => i.source === "refund_credit");

  return {
    failedPaymentCount,
    failedPaymentRatePercent: computeFailedPaymentRate(
      failedPaymentCount,
      totalPaymentAttempts,
    ),
    refundRatePercent: computeRefundRatePercent(refundsCreditsCents, grossRevenueCents),
    reconciliationFailureCount: countReconciliationFailures(input.items),
    stalePendingFinanceItems: countStalePendingItems(
      input.items,
      input.stalePendingBeforeIso,
    ),
    savedCardChargeSuccessRatePercent: computeSuccessRatePercent(
      savedCardSuccess,
      savedCardAttempts,
    ),
    savedCardChargeAttempts: savedCardAttempts,
    zohoSyncHealth: aggregateSyncHealth(bookingSyncItems, "booking"),
    refundCreditSyncHealth: aggregateSyncHealth(refundItems, "refund_credit"),
    failedPaymentTrend: buildFailedPaymentTrend(input.paymentAttempts, input.trendGranularity),
    refundTrend: buildRefundTrend(input.items, input.trendGranularity),
  };
}
