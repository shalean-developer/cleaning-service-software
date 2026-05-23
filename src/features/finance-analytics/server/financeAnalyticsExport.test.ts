import { describe, expect, it } from "vitest";
import type { FinanceAnalyticsResult } from "./financeAnalyticsTypes";
import {
  financeAnalyticsOperationalToCsv,
  financeAnalyticsProfitabilityToCsv,
  financeAnalyticsRevenueTrendsToCsv,
  financeAnalyticsSectionToCsv,
  financeAnalyticsSummaryToCsv,
} from "./financeAnalyticsExport";

function sampleData(): FinanceAnalyticsResult {
  return {
    executiveSummary: {
      grossRevenueCents: 10000,
      refundsCreditsCents: 1000,
      netRevenueCents: 9000,
      cleanerPayoutsCents: 3000,
      estimatedGrossProfitCents: 6000,
      estimatedGrossMarginPercent: 66.7,
      totalBookings: 5,
      paidBookings: 4,
      repeatCustomerRatePercent: 25,
      averageBookingValueCents: 2250,
      failedPaymentRatePercent: 10,
    },
    revenueTrends: [
      {
        period: "2026-07-01",
        grossRevenueCents: 10000,
        netRevenueCents: 9000,
        refundsCreditsCents: 1000,
        bookingCount: 4,
        savedCardChargesCents: 0,
        corporateRevenueCents: 2000,
        residentialRevenueCents: 8000,
      },
    ],
    profitability: {
      cleanerPayoutsCents: 3000,
      payoutRatioPercent: 33.3,
      estimatedGrossProfitCents: 6000,
      estimatedMarginPercent: 66.7,
      revenueByServiceType: [
        {
          serviceType: "standard-clean",
          serviceLabel: "Standard clean",
          revenueCents: 8000,
          estimatedPayoutCents: 2400,
          estimatedMarginPercent: 70,
        },
      ],
      revenueByCustomerType: { corporateCents: 2000, residentialCents: 8000 },
      topProfitableServices: [],
      lowestMarginServices: [],
    },
    customerInsights: {
      repeatCustomerRatePercent: 25,
      totalCustomers: 4,
      repeatCustomers: 1,
      topCustomersByRevenue: [],
      corporateVsResidential: {
        corporateCents: 2000,
        residentialCents: 8000,
        corporatePercent: 20,
      },
      averageLifetimeRevenueCents: 5000,
      paymentMethodUsage: {
        bookingCheckout: 4,
        invoiceCheckout: 1,
        savedCard: 0,
      },
      savedCardAdoptionRatePercent: 0,
      invoiceVsBookingRevenueSplit: { invoiceCents: 2000, bookingCents: 8000 },
    },
    operationalHealth: {
      failedPaymentCount: 1,
      failedPaymentRatePercent: 10,
      refundRatePercent: 10,
      reconciliationFailureCount: 0,
      stalePendingFinanceItems: 0,
      savedCardChargeSuccessRatePercent: 100,
      savedCardChargeAttempts: 0,
      zohoSyncHealth: { matched: 4, pending: 0, failed: 0, mismatch: 0 },
      refundCreditSyncHealth: { matched: 1, pending: 0, failed: 0, mismatch: 0 },
      failedPaymentTrend: [],
      refundTrend: [],
    },
  };
}

describe("financeAnalyticsExport", () => {
  it("exports safe summary CSV without secrets", () => {
    const csv = financeAnalyticsSummaryToCsv(
      sampleData(),
      "2026-07-01T00:00:00.000Z",
      "2026-07-31T23:59:59.999Z",
    );
    expect(csv).toContain("gross_revenue_cents");
    expect(csv).toContain("9000");
    expect(csv).not.toContain("authorization_code");
    expect(csv).not.toContain("metadata");
    expect(csv).not.toContain("@");
  });

  it("exports revenue trends, profitability, and operational sections", () => {
    const data = sampleData();
    expect(financeAnalyticsRevenueTrendsToCsv(data)).toContain("2026-07-01");
    expect(financeAnalyticsProfitabilityToCsv(data)).toContain("standard-clean");
    expect(financeAnalyticsOperationalToCsv(data)).toContain("failed_payment_count");

    expect(
      financeAnalyticsSectionToCsv(
        data,
        "summary",
        "2026-07-01T00:00:00.000Z",
        "2026-07-31T23:59:59.999Z",
      ),
    ).toContain("estimated_gross_margin_percent");
  });
});
