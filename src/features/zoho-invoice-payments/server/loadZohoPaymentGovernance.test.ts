import { describe, expect, it, vi } from "vitest";
import {
  exportZohoInvoicePaymentAudit,
  zohoPaymentAuditRowsToCsv,
} from "./loadZohoPaymentGovernance";

const fromMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => ({ from: fromMock }),
}));

function chainResult(data: unknown, error: null | { message: string } = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve(onFulfilled({ data, error }));
    },
  };
  return builder;
}

describe("exportZohoInvoicePaymentAudit", () => {
  it("excludes authorization_code and raw metadata from export rows", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "zoho_invoice_payments") {
        return chainResult([
          {
            invoice_number: "INV-001",
            status: "paid",
            amount_cents: 1000,
            currency: "ZAR",
            created_at: "2026-01-01T00:00:00.000Z",
            paid_at: "2026-01-01T01:00:00.000Z",
            paystack_reference: "zi_INV_001",
            authorization_code: "AUTH_secret",
            metadata: { authorization_code: "AUTH_secret" },
          },
        ]);
      }
      if (table === "zoho_invoice_authorization_charges") {
        return chainResult([
          {
            invoice_number: "INV-002",
            status: "paid",
            amount_cents: 2000,
            currency: "ZAR",
            created_at: "2026-01-02T00:00:00.000Z",
            paid_at: "2026-01-02T01:00:00.000Z",
            initiated_by_admin_id: "admin-1",
            reason: "Approved by customer",
            paystack_reference: "zia_INV_002",
            payment_method_id: "pm-1",
            authorization_code: "AUTH_secret",
          },
        ]);
      }
      if (table === "zoho_invoice_payment_methods") {
        return chainResult([
          {
            id: "pm-1",
            card_type: "visa",
            bank: null,
            last4: "4081",
            consented_at: "2026-01-01T00:00:00.000Z",
            revoked_at: null,
            source_invoice_number: "INV-001",
            authorization_code: "AUTH_secret",
          },
        ]);
      }
      if (table === "zoho_invoice_payment_method_audit") {
        return chainResult([
          {
            payment_method_id: "pm-1",
            action: "revoked",
            actor_type: "admin",
            reason: "Customer requested removal",
            created_at: "2026-01-03T00:00:00.000Z",
          },
        ]);
      }
      return chainResult([]);
    });

    const { rows } = await exportZohoInvoicePaymentAudit(50);
    const serialized = JSON.stringify(rows);

    expect(serialized).not.toContain("authorization_code");
    expect(serialized).not.toContain("AUTH_secret");
    expect(serialized).not.toContain("access_code");
    expect(serialized).not.toContain("authorization_url");
    expect(rows.some((row) => row.maskedCard?.includes("4081"))).toBe(true);
  });

  it("csv export contains headers only once", () => {
    const csv = zohoPaymentAuditRowsToCsv([
      {
        recordType: "invoice_payment",
        invoiceNumber: "INV-001",
        status: "paid",
        amountCents: 1000,
        currency: "ZAR",
        createdAt: "2026-01-01T00:00:00.000Z",
        paidAt: null,
        initiatedByAdminId: null,
        action: null,
        reason: null,
        maskedCard: null,
        paystackReference: "zi_INV_001",
      },
    ]);

    expect(csv.startsWith("recordType,invoiceNumber,status")).toBe(true);
    expect(csv).not.toContain("authorization_code");
  });
});
