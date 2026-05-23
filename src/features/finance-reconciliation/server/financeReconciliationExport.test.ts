import { describe, expect, it } from "vitest";
import {
  assertFinanceReconciliationCsvSafe,
  financeReconciliationItemsToCsv,
} from "./financeReconciliationExport";
import type { FinanceReconciliationItem } from "./financeReconciliationReadModel";

const sampleItem: FinanceReconciliationItem = {
  id: "booking:pay-1",
  source: "booking",
  reference: "pay-ref",
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
  actionHint: "No action required.",
};

describe("financeReconciliationExport", () => {
  it("generates CSV with safe fields only", () => {
    const csv = financeReconciliationItemsToCsv([sampleItem]);
    expect(csv).toContain("source,reference,invoice_number");
    expect(csv).toContain("booking,pay-ref,INV-001");
    expect(csv).not.toContain("@");
    expect(csv).not.toContain("authorization_code");
    expect(csv).not.toContain("metadata");
  });

  it("rejects CSV containing forbidden patterns", () => {
    expect(() =>
      assertFinanceReconciliationCsvSafe("source,reference\nbooking,authorization_code"),
    ).toThrow(/forbidden pattern/i);
  });
});
