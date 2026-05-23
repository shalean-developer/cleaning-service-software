import "server-only";

import type { FinanceReconciliationItem } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import {
  bucketPeriodKey,
  computeNetRevenue,
  sumRefunds,
  sumSalesRevenue,
} from "./financeAnalyticsCalculations";
import type { RevenueTrendGranularity, RevenueTrendPoint } from "./financeAnalyticsTypes";
import { SALES_SOURCES } from "./financeAnalyticsTypes";

type TrendBucket = {
  grossRevenueCents: number;
  refundsCreditsCents: number;
  bookingCount: number;
  savedCardChargesCents: number;
  corporateRevenueCents: number;
  residentialRevenueCents: number;
};

function emptyBucket(): TrendBucket {
  return {
    grossRevenueCents: 0,
    refundsCreditsCents: 0,
    bookingCount: 0,
    savedCardChargesCents: 0,
    corporateRevenueCents: 0,
    residentialRevenueCents: 0,
  };
}

function effectiveItemDate(item: FinanceReconciliationItem): string {
  return item.paidAt ?? item.createdAt;
}

export function buildRevenueTrendAnalytics(
  items: FinanceReconciliationItem[],
  granularity: RevenueTrendGranularity,
): RevenueTrendPoint[] {
  const buckets = new Map<string, TrendBucket>();

  for (const item of items) {
    const period = bucketPeriodKey(effectiveItemDate(item), granularity);
    const bucket = buckets.get(period) ?? emptyBucket();

    if (SALES_SOURCES.has(item.source)) {
      bucket.grossRevenueCents += item.amountCents;

      if (item.source === "booking") {
        bucket.residentialRevenueCents += item.amountCents;
        if (item.reconciliationStatus === "matched") {
          bucket.bookingCount += 1;
        }
      } else if (item.source === "zoho_invoice") {
        bucket.corporateRevenueCents += item.amountCents;
      } else if (item.source === "saved_card_invoice") {
        bucket.corporateRevenueCents += item.amountCents;
        bucket.savedCardChargesCents += item.amountCents;
      }
    } else if (item.source === "refund_credit") {
      bucket.refundsCreditsCents += item.amountCents;
    }

    buckets.set(period, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, bucket]) => ({
      period,
      grossRevenueCents: bucket.grossRevenueCents,
      netRevenueCents: computeNetRevenue(
        bucket.grossRevenueCents,
        bucket.refundsCreditsCents,
      ),
      refundsCreditsCents: bucket.refundsCreditsCents,
      bookingCount: bucket.bookingCount,
      savedCardChargesCents: bucket.savedCardChargesCents,
      corporateRevenueCents: bucket.corporateRevenueCents,
      residentialRevenueCents: bucket.residentialRevenueCents,
    }));
}

/** @internal exported for tests */
export function aggregatePeriodRevenue(items: FinanceReconciliationItem[]): {
  grossRevenueCents: number;
  refundsCreditsCents: number;
  netRevenueCents: number;
} {
  const grossRevenueCents = sumSalesRevenue(items);
  const refundsCreditsCents = sumRefunds(items);
  return {
    grossRevenueCents,
    refundsCreditsCents,
    netRevenueCents: computeNetRevenue(grossRevenueCents, refundsCreditsCents),
  };
}
