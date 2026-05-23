import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ZohoInvoicePaymentRow } from "@/lib/database/types";
import {
  createZohoInvoicePaymentAttempt,
  findActiveZohoInvoicePaymentByInvoiceNumber,
  updateZohoInvoicePaymentPaystackInitialized,
} from "./zohoInvoicePaymentRepository";

function sampleRow(overrides: Partial<ZohoInvoicePaymentRow> = {}): ZohoInvoicePaymentRow {
  return {
    id: "pay-1",
    invoice_number: "INV-001602",
    zoho_invoice_id: "zoho-1",
    customer_name: "Jane",
    customer_email: "jane@example.com",
    amount_cents: 10_000,
    currency: "ZAR",
    paystack_reference: null,
    paystack_access_code: null,
    paystack_authorization_url: null,
    paystack_status: null,
    zoho_payment_id: null,
    zoho_status: null,
    status: "initialized",
    idempotency_key: "key-1",
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    paid_at: null,
    ...overrides,
  };
}

function createMockClient(row: ZohoInvoicePaymentRow) {
  const store = { ...row };

  const client = {
    from(table: string) {
      if (table !== "zoho_invoice_payments") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        insert: (payload: Record<string, unknown>) => ({
          select: () => ({
            single: async () => ({
              data: { ...store, ...payload, id: store.id },
              error: null,
            }),
          }),
        }),
        select: () => ({
          eq: (_column: string, value: string) => ({
            in: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: value === store.invoice_number ? store : null, error: null }),
                }),
              }),
            }),
            maybeSingle: async () => ({ data: store.paystack_reference === value ? store : null, error: null }),
          }),
        }),
        update: (patch: Partial<ZohoInvoicePaymentRow>) => ({
          eq: (_column: string, id: string) => ({
            select: () => ({
              single: async () => {
                Object.assign(store, patch, { id });
                return { data: store, error: null };
              },
            }),
          }),
        }),
      };
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    store,
  };
}

describe("zohoInvoicePaymentRepository", () => {
  it("creates payment attempt rows", async () => {
    const { client } = createMockClient(sampleRow());
    const row = await createZohoInvoicePaymentAttempt(
      {
        invoiceNumber: "INV-001602",
        zohoInvoiceId: "zoho-1",
        customerName: "Jane",
        customerEmail: "jane@example.com",
        amountCents: 10_000,
        currency: "ZAR",
        idempotencyKey: "key-1",
      },
      client,
    );

    expect(row.invoice_number).toBe("INV-001602");
    expect(row.status).toBe("initialized");
  });

  it("finds active payment by invoice number", async () => {
    const { client } = createMockClient(sampleRow({ status: "pending_paystack" }));
    const row = await findActiveZohoInvoicePaymentByInvoiceNumber("INV-001602", client);
    expect(row?.status).toBe("pending_paystack");
  });

  it("updates paystack initialized fields", async () => {
    const { client, store } = createMockClient(sampleRow());
    const row = await updateZohoInvoicePaymentPaystackInitialized(
      "pay-1",
      {
        paystackReference: "zi_INV_001602_ab12cd34",
        paystackAccessCode: "access",
        paystackAuthorizationUrl: "https://checkout.paystack.com/test",
        paystackStatus: "initialized",
      },
      client,
    );

    expect(row.status).toBe("pending_paystack");
    expect(store.paystack_reference).toBe("zi_INV_001602_ab12cd34");
  });
});
