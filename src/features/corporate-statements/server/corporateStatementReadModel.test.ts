import { describe, expect, it } from "vitest";
import type { RawStatementLine } from "./corporateStatementReadModel";
import {
  applyRunningBalances,
  computeCorporateStatementSummary,
  computeOpeningBalanceCents,
} from "./corporateStatementReadModel";

function line(
  overrides: Partial<RawStatementLine> & Pick<RawStatementLine, "id" | "date">,
): RawStatementLine {
  return {
    type: "payment",
    reference: "ref-1",
    invoiceNumber: "INV-001",
    description: "Payment",
    debitCents: 0,
    creditCents: 10000,
    status: "paid",
    ...overrides,
  };
}

describe("corporateStatementReadModel calculations", () => {
  it("computes opening balance from pre-period debits and credits", () => {
    const lines = [
      line({ id: "a", date: "2026-06-01T10:00:00.000Z", debitCents: 5000, creditCents: 0, type: "invoice", status: "outstanding" }),
      line({ id: "b", date: "2026-06-15T10:00:00.000Z", creditCents: 5000 }),
    ];
    expect(computeOpeningBalanceCents(lines, "2026-07-01T00:00:00.000Z")).toBe(0);
    expect(computeOpeningBalanceCents([line({ id: "c", date: "2026-06-01T10:00:00.000Z", debitCents: 8000, creditCents: 0, type: "invoice", status: "outstanding" })], "2026-07-01T00:00:00.000Z")).toBe(8000);
  });

  it("applies running balance from opening balance", () => {
    const periodLines = [
      line({ id: "p1", date: "2026-07-02T10:00:00.000Z", debitCents: 10000, creditCents: 0, type: "invoice", status: "outstanding" }),
      line({ id: "p2", date: "2026-07-05T10:00:00.000Z", creditCents: 10000 }),
    ];
    const items = applyRunningBalances(periodLines, 2000);
    expect(items[0]?.balanceCents).toBe(12000);
    expect(items[1]?.balanceCents).toBe(2000);
  });

  it("reduces balance when refund credit is applied", () => {
    const periodLines = [
      line({ id: "p1", date: "2026-07-02T10:00:00.000Z", debitCents: 10000, creditCents: 0, type: "invoice", status: "outstanding" }),
      line({ id: "p2", date: "2026-07-05T10:00:00.000Z", type: "refund_credit", creditCents: 3000, status: "credited" }),
    ];
    const items = applyRunningBalances(periodLines, 0);
    expect(items[1]?.balanceCents).toBe(7000);
  });

  it("computes summary totals for period lines", () => {
    const scope = {
      customerLabel: "Acme Corp",
      customerEmail: "accounts@acme.com",
      normalizedEmails: new Set<string>(),
      zohoCustomerIds: new Set<string>(),
      bookingIds: new Set<string>(),
      nameNeedle: null,
    };
    const periodLines = [
      line({ id: "p1", date: "2026-07-02T10:00:00.000Z", debitCents: 10000, creditCents: 0, type: "invoice", status: "outstanding" }),
      line({ id: "p2", date: "2026-07-05T10:00:00.000Z", creditCents: 10000, type: "payment" }),
    ];
    const summary = computeCorporateStatementSummary(
      scope,
      "2026-07-01T00:00:00.000Z",
      "2026-07-31T23:59:59.999Z",
      0,
      periodLines,
      0,
    );
    expect(summary.invoiceChargesCents).toBe(10000);
    expect(summary.paymentsCents).toBe(10000);
    expect(summary.paidCount).toBe(1);
    expect(summary.outstandingCount).toBe(1);
  });
});
