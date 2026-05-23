import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: vi.fn(),
  isApiAuthFailure: vi.fn(
    (result: unknown) =>
      typeof result === "object" &&
      result !== null &&
      "status" in result &&
      (result as { status: number }).status >= 400,
  ),
}));

vi.mock("@/features/finance-analytics/server/financeAnalyticsReadModel", () => ({
  loadFinanceAnalytics: vi.fn(),
}));

vi.mock("@/features/finance-analytics/server/parseFinanceAnalyticsQueryParams", () => ({
  parseFinanceAnalyticsQueryParams: vi.fn(() => ({
    periodType: "monthly",
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-07-31T23:59:59.999Z",
    trendGranularity: "weekly",
  })),
}));

describe("GET /api/admin/finance/analytics", () => {
  it("returns 401 for non-admin", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    vi.mocked(requireApiUser).mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Sign in required.",
      status: 401,
    });

    const response = await GET(new Request("http://localhost/api/admin/finance/analytics"));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  it("returns analytics payload for admin", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    const { loadFinanceAnalytics } = await import(
      "@/features/finance-analytics/server/financeAnalyticsReadModel"
    );

    vi.mocked(requireApiUser).mockResolvedValueOnce({
      id: "admin-1",
      role: "admin",
      email: "admin@example.com",
    });

    vi.mocked(loadFinanceAnalytics).mockResolvedValueOnce({
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
      revenueTrends: [],
      profitability: {
        cleanerPayoutsCents: 3000,
        payoutRatioPercent: 33.3,
        estimatedGrossProfitCents: 6000,
        estimatedMarginPercent: 66.7,
        revenueByServiceType: [],
        revenueByCustomerType: { corporateCents: 0, residentialCents: 9000 },
        topProfitableServices: [],
        lowestMarginServices: [],
      },
      customerInsights: {
        repeatCustomerRatePercent: 25,
        totalCustomers: 4,
        repeatCustomers: 1,
        topCustomersByRevenue: [],
        corporateVsResidential: {
          corporateCents: 0,
          residentialCents: 9000,
          corporatePercent: 0,
        },
        averageLifetimeRevenueCents: 5000,
        paymentMethodUsage: {
          bookingCheckout: 4,
          invoiceCheckout: 0,
          savedCard: 0,
        },
        savedCardAdoptionRatePercent: 0,
        invoiceVsBookingRevenueSplit: { invoiceCents: 0, bookingCents: 9000 },
      },
      operationalHealth: {
        failedPaymentCount: 0,
        failedPaymentRatePercent: 0,
        refundRatePercent: 11.1,
        reconciliationFailureCount: 0,
        stalePendingFinanceItems: 0,
        savedCardChargeSuccessRatePercent: 0,
        savedCardChargeAttempts: 0,
        zohoSyncHealth: { matched: 4, pending: 0, failed: 0, mismatch: 0 },
        refundCreditSyncHealth: { matched: 0, pending: 0, failed: 0, mismatch: 0 },
        failedPaymentTrend: [],
        refundTrend: [],
      },
    });

    const response = await GET(new Request("http://localhost/api/admin/finance/analytics"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.executiveSummary.netRevenueCents).toBe(9000);
    expect(JSON.stringify(body)).not.toContain("authorization_code");
    expect(JSON.stringify(body)).not.toContain("refresh_token");
  });
});
