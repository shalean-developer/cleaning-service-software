import { describe, expect, it } from "vitest";
import type { AccountingCloseLineItem } from "./accountingCloseReadModel";
import {
  computeAccountingCloseSummary,
  mapReconciliationItemToCloseLineItem,
} from "./accountingCloseReadModel";
import type { FinanceReconciliationItem } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import { evaluateAccountingCloseReadiness } from "./accountingCloseReadiness";

function baseReconciliationItem(
  overrides: Partial<FinanceReconciliationItem> = {},
): FinanceReconciliationItem {
  return {
    id: "booking:pay-1",
    source: "booking",
    reference: "pay-ref-1",
    bookingId: "booking-1",
    invoiceNumber: "INV-001",
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

function closeLineItem(overrides: Partial<AccountingCloseLineItem> = {}): AccountingCloseLineItem {
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

describe("accountingCloseReadModel", () => {
  it("calculates gross sales excluding refunds", () => {
    const items = [
      closeLineItem({ amountCents: 5000, signedAmountCents: 5000 }),
      closeLineItem({
        id: "zoho_invoice:zip-1",
        source: "zoho_invoice",
        amountCents: 3000,
        signedAmountCents: 3000,
      }),
      closeLineItem({
        id: "refund_credit:rc-1",
        source: "refund_credit",
        amountCents: 1000,
        signedAmountCents: -1000,
      }),
    ];

    const summary = computeAccountingCloseSummary(
      items,
      "2026-07-01T00:00:00.000Z",
      "2026-07-31T23:59:59.999Z",
    );

    expect(summary.grossSalesCents).toBe(8000);
    expect(summary.refundsCreditsCents).toBe(1000);
    expect(summary.netSalesCents).toBe(7000);
  });

  it("uses negative signed amounts for refunds and credits", () => {
    const mapped = mapReconciliationItemToCloseLineItem(
      baseReconciliationItem({
        id: "refund_credit:rc-1",
        source: "refund_credit",
        amountCents: 2500,
        reconciliationStatus: "matched",
      }),
    );

    expect(mapped.signedAmountCents).toBe(-2500);
  });

  it("counts matched, pending, and failed amounts", () => {
    const items = [
      closeLineItem({ amountCents: 5000, signedAmountCents: 5000, reconciliationStatus: "matched" }),
      closeLineItem({
        id: "zoho_invoice:zip-1",
        source: "zoho_invoice",
        amountCents: 2000,
        signedAmountCents: 2000,
        reconciliationStatus: "pending",
        status: "pending",
      }),
      closeLineItem({
        id: "saved_card:auth-1",
        source: "saved_card_invoice",
        amountCents: 1500,
        signedAmountCents: 1500,
        reconciliationStatus: "failed",
        status: "failed",
      }),
    ];

    const summary = computeAccountingCloseSummary(
      items,
      "2026-07-01T00:00:00.000Z",
      "2026-07-31T23:59:59.999Z",
      new Date("2026-07-01T12:00:00.000Z"),
    );

    expect(summary.matchedAmountCents).toBe(5000);
    expect(summary.pendingAmountCents).toBe(2000);
    expect(summary.failedAmountCents).toBe(1500);
    expect(summary.paidTransactions).toBe(1);
    expect(summary.failedTransactions).toBe(1);
    expect(summary.unresolvedCount).toBe(2);
  });
});

describe("evaluateAccountingCloseReadiness", () => {
  const periodStart = "2026-07-01T00:00:00.000Z";
  const periodEnd = "2026-07-31T23:59:59.999Z";

  it("returns readyToClose true when period is clean", () => {
    const items = [closeLineItem()];
    const summary = computeAccountingCloseSummary(items, periodStart, periodEnd);
    expect(summary.readyToClose).toBe(true);
    expect(summary.blockingIssues).toEqual([]);
  });

  it("returns readyToClose false with mismatch", () => {
    const result = evaluateAccountingCloseReadiness([
      closeLineItem({ reconciliationStatus: "mismatch", status: "mismatch", issueCode: "AMOUNT_MISMATCH" }),
    ]);
    expect(result.readyToClose).toBe(false);
    expect(result.blockingIssues[0]).toContain("reconciliation mismatch");
  });

  it("returns readyToClose false with failed transaction", () => {
    const result = evaluateAccountingCloseReadiness([
      closeLineItem({
        reconciliationStatus: "failed",
        status: "failed",
        issueCode: "PAYSTACK_FAILED",
      }),
    ]);
    expect(result.readyToClose).toBe(false);
    expect(result.blockingIssues.some((issue) => issue.includes("failed transaction"))).toBe(true);
  });

  it("returns readyToClose false with stale pending items", () => {
    const result = evaluateAccountingCloseReadiness(
      [
        closeLineItem({
          reconciliationStatus: "pending",
          status: "pending",
          issueCode: "PAYSTACK_PENDING",
          createdAt: "2026-07-01T08:00:00.000Z",
        }),
      ],
      new Date("2026-07-01T09:00:00.000Z"),
    );
    expect(result.readyToClose).toBe(false);
    expect(result.blockingIssues.some((issue) => issue.includes("older than 30 minutes"))).toBe(
      true,
    );
  });

  it("returns readyToClose false with failed Zoho sync", () => {
    const result = evaluateAccountingCloseReadiness([
      closeLineItem({
        reconciliationStatus: "failed",
        status: "failed",
        issueCode: "ZOHO_SYNC_FAILED",
      }),
    ]);
    expect(result.readyToClose).toBe(false);
    expect(result.blockingIssues.some((issue) => issue.includes("failed Zoho sync"))).toBe(true);
  });

  it("returns readyToClose false with failed refund credit", () => {
    const result = evaluateAccountingCloseReadiness([
      closeLineItem({
        id: "refund_credit:rc-1",
        source: "refund_credit",
        signedAmountCents: -1000,
        reconciliationStatus: "failed",
        status: "failed",
        issueCode: "CREDIT_NOTE_FAILED",
      }),
    ]);
    expect(result.readyToClose).toBe(false);
    expect(result.blockingIssues.some((issue) => issue.includes("refund credit"))).toBe(true);
  });
});
