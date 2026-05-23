import { describe, expect, it } from "vitest";
import type { FinanceReconciliationItem } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import { buildExecutiveSummary } from "./financeAnalyticsReadModel";
import { buildProfitabilityAnalytics } from "./profitabilityAnalytics";
import { buildOperationalFinanceAnalytics } from "./operationalFinanceAnalytics";
import { computeRepeatStats, customerLabelFromItem } from "./customerRevenueAnalytics";

function item(
  overrides: Partial<FinanceReconciliationItem> = {},
): FinanceReconciliationItem {
  return {
    id: "booking:pay-1",
    source: "booking",
    reference: "pay-ref",
    bookingId: "booking-1",
    invoiceNumber: null,
    customerLabel: "jane@example.com",
    amountCents: 5000,
    currency: "ZAR",
    shaleanStatus: "paid",
    paystackStatus: "success",
    zohoStatus: "synced",
    reconciliationStatus: "matched",
    issueCode: "MATCHED",
    issueLabel: "Matched",
    createdAt: "2026-07-01T10:00:00.000Z",
    paidAt: "2026-07-01T10:05:00.000Z",
    syncedAt: "2026-07-01T10:05:00.000Z",
    actionHint: null,
    ...overrides,
  };
}

describe("finance analytics read models", () => {
  it("builds executive summary with profitability formulas", () => {
    const summary = buildExecutiveSummary({
      items: [
        item({ amountCents: 10000 }),
        item({ id: "refund:1", source: "refund_credit", amountCents: 2000 }),
      ],
      cleanerPayoutsCents: 3000,
      totalBookings: 5,
      paymentAttempts: [
        { status: "paid", created_at: "2026-07-01T10:00:00.000Z", booking_id: "b1", amount_cents: 10000 },
        { status: "failed", created_at: "2026-07-01T11:00:00.000Z", booking_id: "b2", amount_cents: 0 },
      ],
      repeatCustomers: 2,
      totalCustomers: 4,
    });

    expect(summary.grossRevenueCents).toBe(10000);
    expect(summary.netRevenueCents).toBe(8000);
    expect(summary.estimatedGrossProfitCents).toBe(5000);
    expect(summary.estimatedGrossMarginPercent).toBe(62.5);
    expect(summary.averageBookingValueCents).toBe(8000);
    expect(summary.repeatCustomerRatePercent).toBe(50);
    expect(summary.failedPaymentRatePercent).toBe(50);
  });

  it("builds profitability analytics with payout ratio", () => {
    const profitability = buildProfitabilityAnalytics({
      items: [
        item({ amountCents: 8000 }),
        item({ id: "corp:1", source: "zoho_invoice", amountCents: 2000 }),
      ],
      earningLines: [{ booking_id: "booking-1", payout_amount_cents: 3000 }],
      bookingById: new Map([
        ["booking-1", { id: "booking-1", metadata: { serviceSlug: "standard-clean" } }],
      ]),
    });

    expect(profitability.cleanerPayoutsCents).toBe(3000);
    expect(profitability.payoutRatioPercent).toBe(30);
    expect(profitability.revenueByCustomerType.residentialCents).toBe(8000);
    expect(profitability.revenueByCustomerType.corporateCents).toBe(2000);
  });

  it("builds operational health counts", () => {
    const health = buildOperationalFinanceAnalytics({
      items: [
        item(),
        item({ id: "saved:1", source: "saved_card_invoice", reconciliationStatus: "failed" }),
        item({ id: "refund:1", source: "refund_credit", amountCents: 500, reconciliationStatus: "pending" }),
      ],
      paymentAttempts: [
        { status: "failed", created_at: "2026-07-01T10:00:00.000Z" },
        { status: "paid", created_at: "2026-07-01T11:00:00.000Z" },
      ],
      trendGranularity: "daily",
      stalePendingBeforeIso: "2026-07-05T00:00:00.000Z",
    });

    expect(health.failedPaymentCount).toBe(1);
    expect(health.reconciliationFailureCount).toBe(1);
    expect(health.savedCardChargeAttempts).toBe(1);
    expect(health.refundCreditSyncHealth.pending).toBe(1);
  });

  it("masks customer labels and computes repeat stats", () => {
    expect(customerLabelFromItem(item({ customerLabel: "jane@example.com" }))).toBe(
      "j***@example.com",
    );

    const stats = computeRepeatStats(new Set(["c1", "c2"]), [
      { customerId: "c1", paidBookingCount: 3 },
      { customerId: "c2", paidBookingCount: 1 },
    ]);
    expect(stats.repeatCustomers).toBe(1);
    expect(stats.repeatCustomerRatePercent).toBe(50);
  });
});
