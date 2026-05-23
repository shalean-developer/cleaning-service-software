import "server-only";

import type { FinanceReconciliationItem } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import {
  resolveServiceSlugFromMetadata,
  serviceLabelFromSlug,
} from "@/features/dashboards/server/parseBookingDisplay";
import type { Json } from "@/lib/database/types";
import {
  computeEstimatedGrossProfit,
  computeMarginPercent,
  computePayoutRatio,
  sumRevenueBySourceSet,
} from "./financeAnalyticsCalculations";
import type { ProfitabilityAnalytics, ServiceProfitabilityRow } from "./financeAnalyticsTypes";
import { CORPORATE_SOURCES, RESIDENTIAL_SOURCES } from "./financeAnalyticsTypes";
import { aggregatePeriodRevenue } from "./revenueTrendAnalytics";

type EarningLineSlice = {
  booking_id: string | null;
  payout_amount_cents: number;
};

type BookingServiceSlice = {
  id: string;
  metadata: Json;
};

function buildServiceRows(
  items: FinanceReconciliationItem[],
  bookingById: Map<string, BookingServiceSlice>,
  earningLines: EarningLineSlice[],
  totalPayoutCents: number,
  grossRevenueCents: number,
): ServiceProfitabilityRow[] {
  const revenueByService = new Map<string, { label: string; cents: number }>();
  const payoutByBooking = new Map<string, number>();

  for (const line of earningLines) {
    if (!line.booking_id) continue;
    payoutByBooking.set(
      line.booking_id,
      (payoutByBooking.get(line.booking_id) ?? 0) + line.payout_amount_cents,
    );
  }

  for (const item of items) {
    if (item.source !== "booking" || item.reconciliationStatus !== "matched") continue;
    const booking = item.bookingId ? bookingById.get(item.bookingId) : null;
    const slug = resolveServiceSlugFromMetadata(booking?.metadata ?? null) ?? "unknown";
    const label = serviceLabelFromSlug(slug);
    const existing = revenueByService.get(slug);
    if (existing) {
      existing.cents += item.amountCents;
    } else {
      revenueByService.set(slug, { label, cents: item.amountCents });
    }
  }

  const bookingRevenueCents = [...revenueByService.values()].reduce((s, e) => s + e.cents, 0);
  const payoutRatio =
    bookingRevenueCents > 0 ? totalPayoutCents / bookingRevenueCents : 0;

  return [...revenueByService.entries()]
    .map(([serviceType, entry]) => {
      const estimatedPayoutCents = Math.round(entry.cents * payoutRatio);
      const estimatedProfit = entry.cents - estimatedPayoutCents;
      return {
        serviceType,
        serviceLabel: entry.label,
        revenueCents: entry.cents,
        estimatedPayoutCents,
        estimatedMarginPercent:
          entry.cents > 0
            ? computeMarginPercent(estimatedProfit, entry.cents)
            : null,
      };
    })
    .sort((a, b) => b.revenueCents - a.revenueCents);
}

function pickTopProfitable(services: ServiceProfitabilityRow[]): ServiceProfitabilityRow[] {
  return [...services]
    .filter((s) => s.revenueCents > 0)
    .sort((a, b) => {
      const marginA = a.estimatedMarginPercent ?? 0;
      const marginB = b.estimatedMarginPercent ?? 0;
      if (marginB !== marginA) return marginB - marginA;
      return b.revenueCents - a.revenueCents;
    })
    .slice(0, 5);
}

function pickLowestMargin(services: ServiceProfitabilityRow[]): ServiceProfitabilityRow[] {
  return [...services]
    .filter((s) => s.revenueCents > 0)
    .sort((a, b) => {
      const marginA = a.estimatedMarginPercent ?? 0;
      const marginB = b.estimatedMarginPercent ?? 0;
      if (marginA !== marginB) return marginA - marginB;
      return b.revenueCents - a.revenueCents;
    })
    .slice(0, 5);
}

export function buildProfitabilityAnalytics(input: {
  items: FinanceReconciliationItem[];
  earningLines: EarningLineSlice[];
  bookingById: Map<string, BookingServiceSlice>;
}): ProfitabilityAnalytics {
  const { grossRevenueCents, netRevenueCents } = aggregatePeriodRevenue(input.items);
  const cleanerPayoutsCents = input.earningLines.reduce(
    (sum, line) => sum + line.payout_amount_cents,
    0,
  );
  const estimatedGrossProfitCents = computeEstimatedGrossProfit(
    netRevenueCents,
    cleanerPayoutsCents,
  );

  const revenueByServiceType = buildServiceRows(
    input.items,
    input.bookingById,
    input.earningLines,
    cleanerPayoutsCents,
    grossRevenueCents,
  );

  const corporateCents = sumRevenueBySourceSet(input.items, CORPORATE_SOURCES);
  const residentialCents = sumRevenueBySourceSet(input.items, RESIDENTIAL_SOURCES);

  return {
    cleanerPayoutsCents,
    payoutRatioPercent: computePayoutRatio(cleanerPayoutsCents, netRevenueCents),
    estimatedGrossProfitCents,
    estimatedMarginPercent: computeMarginPercent(estimatedGrossProfitCents, netRevenueCents),
    revenueByServiceType,
    revenueByCustomerType: {
      corporateCents,
      residentialCents,
    },
    topProfitableServices: pickTopProfitable(revenueByServiceType),
    lowestMarginServices: pickLowestMargin(revenueByServiceType),
  };
}
