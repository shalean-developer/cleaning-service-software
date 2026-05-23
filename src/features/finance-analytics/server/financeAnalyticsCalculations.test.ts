import { describe, expect, it } from "vitest";
import {
  aggregateSyncHealth,
  bucketPeriodKey,
  computeAverageBookingValue,
  computeEstimatedGrossProfit,
  computeFailedPaymentRate,
  computeMarginPercent,
  computeNetRevenue,
  computePayoutRatio,
  computeRefundRatePercent,
  computeRepeatCustomerRate,
  computeSuccessRatePercent,
  countPaidBookings,
  countReconciliationFailures,
  countStalePendingItems,
  sumRefunds,
  sumSalesRevenue,
} from "./financeAnalyticsCalculations";
import type { FinanceReconciliationItem } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";

function item(
  overrides: Partial<FinanceReconciliationItem> = {},
): FinanceReconciliationItem {
  return {
    id: "booking:pay-1",
    source: "booking",
    reference: "pay-ref",
    bookingId: "booking-1",
    invoiceNumber: null,
    customerLabel: "Booking abc12345",
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

describe("financeAnalyticsCalculations", () => {
  it("computes net revenue with refund subtraction", () => {
    expect(computeNetRevenue(10000, 1500)).toBe(8500);
  });

  it("computes gross profit and margin", () => {
    const profit = computeEstimatedGrossProfit(8500, 3000);
    expect(profit).toBe(5500);
    expect(computeMarginPercent(profit, 8500)).toBe(64.7);
  });

  it("computes repeat customer rate", () => {
    expect(computeRepeatCustomerRate(3, 10)).toBe(30);
    expect(computeRepeatCustomerRate(0, 0)).toBe(0);
  });

  it("computes average booking value", () => {
    expect(computeAverageBookingValue(10000, 4)).toBe(2500);
    expect(computeAverageBookingValue(10000, 0)).toBe(0);
  });

  it("computes failed payment rate", () => {
    expect(computeFailedPaymentRate(2, 20)).toBe(10);
  });

  it("computes payout ratio", () => {
    expect(computePayoutRatio(4000, 10000)).toBe(40);
  });

  it("aggregates sales revenue and refunds", () => {
    const items = [
      item({ amountCents: 5000 }),
      item({ id: "zoho:1", source: "zoho_invoice", amountCents: 3000 }),
      item({ id: "refund:1", source: "refund_credit", amountCents: 1000 }),
    ];
    expect(sumSalesRevenue(items)).toBe(8000);
    expect(sumRefunds(items)).toBe(1000);
  });

  it("counts paid bookings and reconciliation failures", () => {
    const items = [
      item(),
      item({ id: "b2", reconciliationStatus: "pending" }),
      item({ id: "b3", reconciliationStatus: "failed" }),
    ];
    expect(countPaidBookings(items)).toBe(1);
    expect(countReconciliationFailures(items)).toBe(1);
  });

  it("counts stale pending finance items", () => {
    const items = [
      item({ reconciliationStatus: "pending", createdAt: "2026-06-01T10:00:00.000Z" }),
      item({
        id: "recent",
        reconciliationStatus: "pending",
        createdAt: "2026-07-10T10:00:00.000Z",
      }),
    ];
    expect(countStalePendingItems(items, "2026-07-05T00:00:00.000Z")).toBe(1);
  });

  it("aggregates sync health counts", () => {
    const items = [
      item(),
      item({ id: "b2", reconciliationStatus: "pending" }),
      item({ id: "b3", reconciliationStatus: "failed" }),
    ];
    expect(aggregateSyncHealth(items, "booking")).toEqual({
      matched: 1,
      pending: 1,
      failed: 1,
      mismatch: 0,
    });
  });

  it("buckets period keys by granularity", () => {
    expect(bucketPeriodKey("2026-07-15T12:00:00.000Z", "daily")).toBe("2026-07-15");
    expect(bucketPeriodKey("2026-07-15T12:00:00.000Z", "monthly")).toBe("2026-07");
  });

  it("computes refund and success rates", () => {
    expect(computeRefundRatePercent(500, 5000)).toBe(10);
    expect(computeSuccessRatePercent(8, 10)).toBe(80);
  });
});
