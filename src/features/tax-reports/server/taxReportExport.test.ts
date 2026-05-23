import { describe, expect, it } from "vitest";
import type { TaxReportLineItem, TaxReportSummary } from "./taxReportReadModel";
import {
  assertTaxReportCsvSafe,
  taxReportItemsToCsv,
  taxReportSummaryToCsv,
} from "./taxReportExport";

function summary(overrides: Partial<TaxReportSummary> = {}): TaxReportSummary {
  return {
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-07-31T23:59:59.999Z",
    vatRegistered: true,
    vatRate: 15,
    grossSalesCents: 11500,
    refundsCreditsCents: 0,
    netSalesAfterCreditsCents: 11500,
    estimatedOutputVatCents: 1500,
    netExcludingVatCents: 10000,
    transactionCount: 1,
    refundCreditCount: 0,
    ...overrides,
  };
}

function lineItem(overrides: Partial<TaxReportLineItem> = {}): TaxReportLineItem {
  return {
    id: "booking:pay-1",
    source: "booking",
    reference: "pay-ref-1",
    invoiceNumber: "INV-001",
    bookingId: "booking-1",
    grossAmountCents: 11500,
    signedAmountCents: 11500,
    estimatedVatCents: 1500,
    netExcludingVatCents: 10000,
    currency: "ZAR",
    paidAt: "2026-07-01T10:05:00.000Z",
    createdAt: "2026-07-01T10:00:00.000Z",
    reconciliationStatus: "matched",
    unresolved: false,
    ...overrides,
  };
}

describe("taxReportExport", () => {
  it("exports detail CSV without secrets", () => {
    const csv = taxReportItemsToCsv([lineItem()], summary());
    expect(csv).toContain("pay-ref-1");
    expect(csv).toContain("1500");
    expect(csv).not.toContain("authorization_code");
    expect(() => assertTaxReportCsvSafe(csv)).not.toThrow();
  });

  it("exports zero VAT columns when VAT disabled", () => {
    const csv = taxReportItemsToCsv([lineItem()], summary({ vatRegistered: false }));
    expect(csv).toContain(",0,11500,");
  });

  it("exports summary CSV with VAT registered fields", () => {
    const csv = taxReportSummaryToCsv(summary());
    expect(csv).toContain("vat_registered");
    expect(csv).toContain("1500");
    expect(() => assertTaxReportCsvSafe(csv)).not.toThrow();
  });
});
