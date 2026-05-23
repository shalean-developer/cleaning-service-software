import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ZohoInvoicePaymentRow } from "@/lib/database/types";
import type { PaystackChargeFailure } from "@/features/payments/server/paystackTypes";
import { processZohoInvoiceChargeFailure } from "./processZohoInvoiceChargeFailure";

const requireServiceRoleClientMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => requireServiceRoleClientMock(),
}));

vi.mock("@/lib/zoho/customerPayments", () => ({
  createZohoCustomerPaymentForInvoice: vi.fn(),
}));

function sampleRow(overrides: Partial<ZohoInvoicePaymentRow> = {}): ZohoInvoicePaymentRow {
  return {
    id: "pay-1",
    invoice_number: "INV-001602",
    zoho_invoice_id: "zoho-inv-1",
    customer_name: "Jane",
    customer_email: "jane@example.com",
    amount_cents: 10_000,
    currency: "ZAR",
    paystack_reference: "zi_INV_001602_ab12cd34",
    paystack_access_code: "access",
    paystack_authorization_url: "https://checkout.paystack.com/test",
    paystack_status: "initialized",
    zoho_payment_id: null,
    zoho_status: null,
    status: "pending_paystack",
    idempotency_key: "key-1",
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    paid_at: null,
    ...overrides,
  };
}

function createStore(initial: ZohoInvoicePaymentRow) {
  let row = { ...initial };
  const eventIds = new Set<string>();

  const client = {
    from(table: string) {
      if (table === "zoho_invoice_payments") {
        return {
          select: () => ({
            eq: (column: string, value: string) => ({
              maybeSingle: async () => {
                if (column === "paystack_reference" && row.paystack_reference === value) {
                  return { data: row, error: null };
                }
                if (column === "id" && row.id === value) {
                  return { data: row, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
          update: (patch: Partial<ZohoInvoicePaymentRow>) => ({
            eq: (_column: string, id: string) => ({
              select: () => ({
                single: async () => {
                  if (row.id !== id) return { data: null, error: { message: "not found" } };
                  row = { ...row, ...patch, id };
                  return { data: row, error: null };
                },
              }),
            }),
          }),
        };
      }

      if (table === "zoho_invoice_payment_events") {
        return {
          insert: async (payload: { provider_event_id: string }) => {
            if (eventIds.has(payload.provider_event_id)) {
              return { error: { code: "23505", message: "duplicate" } };
            }
            eventIds.add(payload.provider_event_id);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    getRow: () => row,
  };
}

function sampleFailure(
  overrides: Partial<PaystackChargeFailure> = {},
): PaystackChargeFailure {
  return {
    reference: "zi_INV_001602_ab12cd34",
    amountCents: 10_000,
    providerEventId: "paystack:txn:9101",
    transactionId: 9101,
    paystackStatus: "failed",
    gatewayResponse: "Declined",
    metadata: { source: "zoho_invoice", zoho_invoice_payment_id: "pay-1" },
    ...overrides,
  };
}

describe("processZohoInvoiceChargeFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks row failed and never calls Zoho", async () => {
    const { client, getRow } = createStore(sampleRow());
    requireServiceRoleClientMock.mockReturnValue(client);

    const zohoPayments = await import("@/lib/zoho/customerPayments");
    const zohoSpy = vi.mocked(zohoPayments.createZohoCustomerPaymentForInvoice);

    const result = await processZohoInvoiceChargeFailure(sampleFailure(), "charge.failed", client);
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("failed");
      expect(result.idempotent).toBe(false);
    }
    expect(getRow().status).toBe("failed");
    expect(zohoSpy).not.toHaveBeenCalled();
  });

  it("returns idempotent for duplicate failure events", async () => {
    const { client } = createStore(sampleRow({ status: "failed" }));
    requireServiceRoleClientMock.mockReturnValue(client);

    const first = await processZohoInvoiceChargeFailure(sampleFailure(), "charge.failed", client);
    expect(first.ok).toBe(true);

    const second = await processZohoInvoiceChargeFailure(sampleFailure(), "charge.failed", client);
    expect(second.ok).toBe(true);
    if (second.ok && second.handled) {
      expect(second.idempotent).toBe(true);
    }
  });

  it("skips already paid rows", async () => {
    const { client, getRow } = createStore(
      sampleRow({ status: "paid", zoho_payment_id: "zoho-payment-1" }),
    );
    requireServiceRoleClientMock.mockReturnValue(client);

    const result = await processZohoInvoiceChargeFailure(sampleFailure(), "charge.failed", client);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.handled).toBe(false);
      expect(result.reason).toBe("skipped:already_paid");
    }
    expect(getRow().status).toBe("paid");
  });
});
