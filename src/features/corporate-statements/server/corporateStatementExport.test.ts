import { describe, expect, it } from "vitest";
import type { CorporateStatementLineItem, CorporateStatementSummary } from "./corporateStatementReadModel";
import {
  assertCorporateStatementCsvSafe,
  corporateStatementItemsToCsv,
} from "./corporateStatementExport";

function summary(): CorporateStatementSummary {
  return {
    customerLabel: "Acme Corp",
    customerEmail: "accounts@acme.com",
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-07-31T23:59:59.999Z",
    openingBalanceCents: 0,
    invoiceChargesCents: 10000,
    paymentsCents: 10000,
    refundsCreditsCents: 0,
    closingBalanceCents: 0,
    outstandingCount: 0,
    paidCount: 1,
  };
}

function item(): CorporateStatementLineItem {
  return {
    id: "zoho_invoice:1",
    date: "2026-07-05T10:00:00.000Z",
    type: "payment",
    reference: "pay-ref",
    invoiceNumber: "INV-001",
    description: "Payment received for INV-001",
    debitCents: 0,
    creditCents: 10000,
    balanceCents: 0,
    status: "paid",
  };
}

describe("corporateStatementExport", () => {
  it("exports safe CSV without secrets", () => {
    const csv = corporateStatementItemsToCsv([item()], summary());
    expect(csv).toContain("Acme Corp");
    expect(csv).toContain("pay-ref");
    expect(csv).not.toContain("authorization_code");
    expect(csv).not.toContain("access_code");
    expect(csv).not.toContain("@");
    expect(() => assertCorporateStatementCsvSafe(csv)).not.toThrow();
  });
});
