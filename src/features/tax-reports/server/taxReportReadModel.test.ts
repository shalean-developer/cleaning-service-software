import { describe, expect, it } from "vitest";
import type { FinanceReconciliationItem } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import {
  computeTaxReportSourceBreakdown,
  computeTaxReportSummary,
  isTaxReportEligibleItem,
  mapReconciliationItemToTaxLineItem,
} from "./taxReportReadModel";

function reconciliationItem(
  overrides: Partial<FinanceReconciliationItem> = {},
): FinanceReconciliationItem {
  return {
    id: "booking:pay-1",
    source: "booking",
    reference: "pay-ref-1",
    bookingId: "booking-1",
    invoiceNumber: "INV-001",
    customerLabel: "Booking abc12345",
    amountCents: 11500,
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

describe("taxReportReadModel", () => {
  it("excludes unresolved items by default", () => {
    expect(isTaxReportEligibleItem(reconciliationItem(), false)).toBe(true);
    expect(
      isTaxReportEligibleItem(reconciliationItem({ reconciliationStatus: "pending" }), false),
    ).toBe(false);
    expect(
      isTaxReportEligibleItem(reconciliationItem({ reconciliationStatus: "pending" }), true),
    ).toBe(true);
  });

  it("computes summary totals with VAT on matched sales and negative refund VAT", () => {
    const sale = mapReconciliationItemToTaxLineItem(reconciliationItem(), true, 15);
    const refund = mapReconciliationItemToTaxLineItem(
      reconciliationItem({
        id: "refund_credit:rc-1",
        source: "refund_credit",
        amountCents: 11500,
      }),
      true,
      15,
    );

    const summary = computeTaxReportSummary(
      [sale, refund],
      "2026-07-01T00:00:00.000Z",
      "2026-07-31T23:59:59.999Z",
      true,
      15,
    );

    expect(summary.grossSalesCents).toBe(11500);
    expect(summary.refundsCreditsCents).toBe(11500);
    expect(summary.netSalesAfterCreditsCents).toBe(0);
    expect(summary.estimatedOutputVatCents).toBe(0);
    expect(summary.refundCreditCount).toBe(1);
  });

  it("returns zero VAT in summary when VAT is disabled", () => {
    const sale = mapReconciliationItemToTaxLineItem(reconciliationItem(), false, 15);
    const summary = computeTaxReportSummary(
      [sale],
      "2026-07-01T00:00:00.000Z",
      "2026-07-31T23:59:59.999Z",
      false,
      15,
    );

    expect(summary.estimatedOutputVatCents).toBe(0);
    expect(summary.netExcludingVatCents).toBe(summary.netSalesAfterCreditsCents);
    expect(sale.estimatedVatCents).toBe(0);
  });

  it("computes source breakdown grouped by source", () => {
    const items = [
      mapReconciliationItemToTaxLineItem(reconciliationItem(), true, 15),
      mapReconciliationItemToTaxLineItem(
        reconciliationItem({
          id: "zoho_invoice:zip-1",
          source: "zoho_invoice",
          amountCents: 5000,
        }),
        true,
        15,
      ),
    ];

    const breakdown = computeTaxReportSourceBreakdown(items);
    expect(breakdown).toHaveLength(2);
    expect(breakdown.find((row) => row.source === "booking")?.grossSalesCents).toBe(11500);
    expect(breakdown.find((row) => row.source === "zoho_invoice")?.grossSalesCents).toBe(5000);
  });
});
