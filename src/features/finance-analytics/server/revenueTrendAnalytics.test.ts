import { describe, expect, it } from "vitest";
import type { FinanceReconciliationItem } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import { buildRevenueTrendAnalytics } from "./revenueTrendAnalytics";

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

describe("revenueTrendAnalytics", () => {
  it("aggregates revenue trends by day with refunds subtracted", () => {
    const trends = buildRevenueTrendAnalytics(
      [
        item({ paidAt: "2026-07-01T10:00:00.000Z", amountCents: 5000 }),
        item({
          id: "corp:1",
          source: "zoho_invoice",
          paidAt: "2026-07-01T11:00:00.000Z",
          amountCents: 3000,
        }),
        item({
          id: "refund:1",
          source: "refund_credit",
          paidAt: "2026-07-01T12:00:00.000Z",
          amountCents: 1000,
        }),
        item({
          id: "booking:2",
          paidAt: "2026-07-02T10:00:00.000Z",
          amountCents: 2000,
        }),
      ],
      "daily",
    );

    expect(trends).toHaveLength(2);
    expect(trends[0]).toMatchObject({
      period: "2026-07-01",
      grossRevenueCents: 8000,
      refundsCreditsCents: 1000,
      netRevenueCents: 7000,
      bookingCount: 1,
      corporateRevenueCents: 3000,
      residentialRevenueCents: 5000,
    });
    expect(trends[1]?.netRevenueCents).toBe(2000);
  });
});
