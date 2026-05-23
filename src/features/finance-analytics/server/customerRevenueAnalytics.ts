import "server-only";

import { maskCustomerEmailForDiagnostics } from "@/features/zoho-invoice-payments/server/zohoInvoiceDiagnosticRedaction";
import type { FinanceReconciliationItem } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import {
  computeRepeatCustomerRate,
  sumRevenueBySourceSet,
} from "./financeAnalyticsCalculations";
import type { CustomerRevenueInsights, TopCustomerRow } from "./financeAnalyticsTypes";
import { CORPORATE_SOURCES, RESIDENTIAL_SOURCES, SALES_SOURCES } from "./financeAnalyticsTypes";

type CustomerBookingCount = {
  customerId: string;
  paidBookingCount: number;
};

type SavedCardMethodSlice = {
  customer_email: string;
};

function customerLabelFromItem(item: FinanceReconciliationItem): string {
  if (item.customerLabel?.trim()) {
    const masked = maskCustomerEmailForDiagnostics(item.customerLabel);
    if (masked) return masked;
    return item.customerLabel.slice(0, 24);
  }
  if (item.bookingId) return `Booking ${item.bookingId.slice(0, 8)}`;
  return item.reference.slice(0, 24);
}

function buildTopCustomers(items: FinanceReconciliationItem[]): TopCustomerRow[] {
  const byCustomer = new Map<string, TopCustomerRow>();

  for (const item of items) {
    if (!SALES_SOURCES.has(item.source) || item.reconciliationStatus !== "matched") continue;
    const label = customerLabelFromItem(item);
    const existing = byCustomer.get(label);
    if (existing) {
      existing.revenueCents += item.amountCents;
      existing.transactionCount += 1;
    } else {
      byCustomer.set(label, {
        customerLabel: label,
        revenueCents: item.amountCents,
        transactionCount: 1,
      });
    }
  }

  return [...byCustomer.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 10);
}

function computeRepeatStats(
  periodCustomerIds: Set<string>,
  lifetimeCounts: CustomerBookingCount[],
): { totalCustomers: number; repeatCustomers: number; repeatCustomerRatePercent: number } {
  const totalCustomers = periodCustomerIds.size;
  let repeatCustomers = 0;

  for (const row of lifetimeCounts) {
    if (!periodCustomerIds.has(row.customerId)) continue;
    if (row.paidBookingCount >= 2) repeatCustomers += 1;
  }

  return {
    totalCustomers,
    repeatCustomers,
    repeatCustomerRatePercent: computeRepeatCustomerRate(repeatCustomers, totalCustomers),
  };
}

export function buildCustomerRevenueAnalytics(input: {
  items: FinanceReconciliationItem[];
  periodCustomerIds: Set<string>;
  lifetimeCustomerCounts: CustomerBookingCount[];
  lifetimeRevenueByCustomer: Map<string, number>;
  savedCardMethods: SavedCardMethodSlice[];
  uniqueInvoiceCustomers: number;
}): CustomerRevenueInsights {
  const corporateCents = sumRevenueBySourceSet(input.items, CORPORATE_SOURCES);
  const residentialCents = sumRevenueBySourceSet(input.items, RESIDENTIAL_SOURCES);
  const totalSegmentCents = corporateCents + residentialCents;

  const bookingCheckout = input.items.filter(
    (i) => i.source === "booking" && i.reconciliationStatus === "matched",
  ).length;
  const invoiceCheckout = input.items.filter(
    (i) => i.source === "zoho_invoice" && i.reconciliationStatus === "matched",
  ).length;
  const savedCard = input.items.filter(
    (i) => i.source === "saved_card_invoice" && i.reconciliationStatus === "matched",
  ).length;

  const invoiceCents =
    sumRevenueBySourceSet(input.items, new Set(["zoho_invoice", "saved_card_invoice"]));
  const bookingCents = sumRevenueBySourceSet(input.items, RESIDENTIAL_SOURCES);

  const repeatStats = computeRepeatStats(
    input.periodCustomerIds,
    input.lifetimeCustomerCounts,
  );

  const lifetimeTotals = [...input.lifetimeRevenueByCustomer.values()];
  const averageLifetimeRevenueCents =
    lifetimeTotals.length > 0
      ? Math.round(
          lifetimeTotals.reduce((sum, cents) => sum + cents, 0) / lifetimeTotals.length,
        )
      : 0;

  const savedCardAdoptionRatePercent =
    input.uniqueInvoiceCustomers > 0
      ? Math.round((input.savedCardMethods.length / input.uniqueInvoiceCustomers) * 1000) / 10
      : 0;

  return {
    repeatCustomerRatePercent: repeatStats.repeatCustomerRatePercent,
    totalCustomers: repeatStats.totalCustomers,
    repeatCustomers: repeatStats.repeatCustomers,
    topCustomersByRevenue: buildTopCustomers(input.items),
    corporateVsResidential: {
      corporateCents,
      residentialCents,
      corporatePercent:
        totalSegmentCents > 0
          ? Math.round((corporateCents / totalSegmentCents) * 1000) / 10
          : 0,
    },
    averageLifetimeRevenueCents,
    paymentMethodUsage: {
      bookingCheckout,
      invoiceCheckout,
      savedCard,
    },
    savedCardAdoptionRatePercent,
    invoiceVsBookingRevenueSplit: {
      invoiceCents,
      bookingCents,
    },
  };
}

/** @internal exported for tests */
export { customerLabelFromItem, computeRepeatStats };
