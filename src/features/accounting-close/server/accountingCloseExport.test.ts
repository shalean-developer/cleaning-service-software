import { describe, expect, it } from "vitest";
import type { AccountingCloseSummary } from "./accountingCloseReadModel";
import {
  accountingCloseItemsToCsv,
  accountingCloseSummaryToCsv,
  assertAccountingCloseCsvSafe,
} from "./accountingCloseExport";
import type { AccountingCloseLineItem } from "./accountingCloseReadModel";

function summary(overrides: Partial<AccountingCloseSummary> = {}): AccountingCloseSummary {
  return {
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-07-31T23:59:59.999Z",
    grossSalesCents: 5000,
    refundsCreditsCents: 0,
    netSalesCents: 5000,
    matchedAmountCents: 5000,
    pendingAmountCents: 0,
    mismatchAmountCents: 0,
    failedAmountCents: 0,
    totalTransactions: 1,
    paidTransactions: 1,
    failedTransactions: 0,
    refundCreditCount: 0,
    unresolvedCount: 0,
    readyToClose: true,
    blockingIssues: [],
    ...overrides,
  };
}

function lineItem(overrides: Partial<AccountingCloseLineItem> = {}): AccountingCloseLineItem {
  return {
    id: "booking:pay-1",
    source: "booking",
    reference: "pay-ref-1",
    invoiceNumber: "INV-001",
    bookingId: "booking-1",
    amountCents: 5000,
    currency: "ZAR",
    signedAmountCents: 5000,
    status: "matched",
    reconciliationStatus: "matched",
    issueCode: "MATCHED",
    createdAt: "2026-07-01T10:00:00.000Z",
    paidAt: "2026-07-01T10:05:00.000Z",
    syncedAt: "2026-07-01T10:05:00.000Z",
    ...overrides,
  };
}

describe("accountingCloseExport", () => {
  it("exports detail CSV without secrets", () => {
    const csv = accountingCloseItemsToCsv([lineItem()], summary());
    expect(csv).toContain("booking");
    expect(csv).toContain("pay-ref-1");
    expect(csv).toContain("5000");
    expect(csv).not.toContain("authorization_code");
    expect(csv).not.toContain("refresh_token");
    expect(() => assertAccountingCloseCsvSafe(csv)).not.toThrow();
  });

  it("rejects CSV containing forbidden patterns", () => {
    expect(() => assertAccountingCloseCsvSafe("authorization_code,secret")).toThrow(
      /forbidden pattern/,
    );
  });

  it("exports summary CSV with readiness fields", () => {
    const csv = accountingCloseSummaryToCsv(
      summary({ readyToClose: false, blockingIssues: ["2 reconciliation mismatches"] }),
    );
    expect(csv).toContain("gross_sales_cents");
    expect(csv).toContain("5000");
    expect(csv).toContain("false");
    expect(csv).toContain("2 reconciliation mismatches");
    expect(() => assertAccountingCloseCsvSafe(csv)).not.toThrow();
  });
});
