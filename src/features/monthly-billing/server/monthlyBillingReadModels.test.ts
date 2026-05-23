import { describe, expect, it } from "vitest";
import type { CustomerBillingAccount } from "./monthlyBillingTypes";
import type { MonthlyInvoiceBatch } from "./monthlyBillingTypes";

function accountStatusLabel(account: CustomerBillingAccount | null): string {
  if (!account) return "No billing account";
  if (account.disabledAt) return "Disabled";
  if (account.isMonthlyAccountEnabled) return "Monthly account active";
  return "Standard billing";
}

function invoiceReadinessLabel(batch: MonthlyInvoiceBatch, itemCount: number): string {
  if (batch.status === "void") return "Void";
  if (batch.status === "paid") return "Paid";
  if (batch.status === "overdue") return "Overdue — follow up";
  if (batch.status === "sent") return "Sent — awaiting payment";
  if (batch.status === "generated") return "Generated — ready to send (Phase 2)";
  if (itemCount === 0) return "Draft — no line items yet";
  return "Draft — ready for generation (Phase 2)";
}

describe("monthly billing read model formatting", () => {
  it("formats account status for empty and enabled states", () => {
    expect(accountStatusLabel(null)).toBe("No billing account");
    expect(
      accountStatusLabel({
        id: "a",
        customerId: "c",
        billingMode: "monthly_account",
        zohoCustomerId: null,
        billingEmail: "a@example.com",
        billingTerms: "Net 30",
        isMonthlyAccountEnabled: true,
        approvedByAdminId: "admin",
        approvedAt: "2026-01-01T00:00:00.000Z",
        approvalReason: "Approved",
        disabledAt: null,
        disabledByAdminId: null,
        metadata: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe("Monthly account active");
  });

  it("formats batch invoice readiness labels", () => {
    const draftBatch: MonthlyInvoiceBatch = {
      id: "b1",
      customerId: "c1",
      billingMonth: "2026-05-01",
      status: "draft",
      zohoInvoiceId: null,
      zohoInvoiceNumber: null,
      totalCents: 0,
      currency: "ZAR",
      generatedByAdminId: null,
      generatedAt: null,
      sentAt: null,
      paidAt: null,
      idempotencyKey: null,
      zohoReferenceNumber: null,
      metadata: {},
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    };

    expect(invoiceReadinessLabel(draftBatch, 0)).toBe("Draft — no line items yet");
    expect(invoiceReadinessLabel(draftBatch, 3)).toBe("Draft — ready for generation (Phase 2)");
    expect(invoiceReadinessLabel({ ...draftBatch, status: "paid" }, 3)).toBe("Paid");
  });
});
