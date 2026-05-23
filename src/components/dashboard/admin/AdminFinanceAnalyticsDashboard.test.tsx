import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminFinanceAnalyticsDashboard } from "./AdminFinanceAnalyticsDashboard";

describe("AdminFinanceAnalyticsDashboard", () => {
  it("renders summary cards, sections, exports, and no mutation buttons", () => {
    const html = renderToStaticMarkup(
      <AdminFinanceAnalyticsDashboard
        data={{
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
            topProfitableServices: [
              {
                serviceType: "standard-clean",
                serviceLabel: "Standard clean",
                revenueCents: 8000,
                estimatedPayoutCents: 2400,
                estimatedMarginPercent: 70,
              },
            ],
            lowestMarginServices: [],
          },
          customerInsights: {
            repeatCustomerRatePercent: 25,
            totalCustomers: 4,
            repeatCustomers: 1,
            topCustomersByRevenue: [
              { customerLabel: "j***@example.com", revenueCents: 5000, transactionCount: 2 },
            ],
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
            savedCardChargeAttempts: 1,
            zohoSyncHealth: { matched: 4, pending: 0, failed: 0, mismatch: 0 },
            refundCreditSyncHealth: { matched: 1, pending: 0, failed: 0, mismatch: 0 },
            failedPaymentTrend: [],
            refundTrend: [],
          },
        }}
        filters={{
          periodType: "monthly",
          from: "2026-07-01T00:00:00.000Z",
          to: "2026-07-31T23:59:59.999Z",
          trendGranularity: "weekly",
        }}
      />,
    );

    expect(html).toContain("Executive summary");
    expect(html).toContain("Gross revenue");
    expect(html).toContain("Revenue trends");
    expect(html).toContain("Profitability");
    expect(html).toContain("Customer insights");
    expect(html).toContain("Operational health");
    expect(html).toContain("Summary CSV");
    expect(html).toContain("operational estimates");
    expect(html).toContain("2026-07-01");
    expect(html).not.toContain("Mark paid");
    expect(html).not.toContain("authorization_code");
    expect(html).not.toContain("refresh_token");
  });
});
