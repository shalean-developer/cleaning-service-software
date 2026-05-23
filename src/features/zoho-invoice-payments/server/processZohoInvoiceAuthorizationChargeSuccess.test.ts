import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ZohoInvoiceAuthorizationChargeRow } from "@/lib/database/types";
import { paystackVerifyTransaction } from "@/features/payments/server/paystackClient";
import { createZohoCustomerPaymentForInvoice } from "@/lib/zoho/customerPayments";
import type { PaystackChargeSuccess } from "@/features/payments/server/paystackTypes";
import { processZohoInvoiceAuthorizationChargeSuccess } from "./processZohoInvoiceAuthorizationChargeSuccess";

const requireServiceRoleClientMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => requireServiceRoleClientMock(),
}));

vi.mock("@/features/payments/server/paystackClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/payments/server/paystackClient")>();
  return {
    ...actual,
    paystackVerifyTransaction: vi.fn(),
  };
});

vi.mock("@/lib/zoho/customerPayments", () => ({
  createZohoCustomerPaymentForInvoice: vi.fn(),
}));

vi.mock("@/lib/zoho/zohoInvoicePaymentLogger", () => ({
  logZohoInvoicePaymentEvent: vi.fn(),
}));

function sampleRow(
  overrides: Partial<ZohoInvoiceAuthorizationChargeRow> = {},
): ZohoInvoiceAuthorizationChargeRow {
  return {
    id: "charge-1",
    invoice_number: "INV-001602",
    zoho_invoice_id: "zoho-inv-1",
    payment_method_id: "pm-1",
    customer_email: "jane@example.com",
    amount_cents: 10_000,
    currency: "ZAR",
    paystack_reference: "zia_INV_001602_ab12cd34",
    paystack_status: "pending_webhook",
    zoho_payment_id: null,
    zoho_status: null,
    status: "pending_webhook",
    initiated_by_admin_id: "admin-1",
    reason: "Customer approved charge",
    metadata: {},
    reconcile_attempts: 0,
    last_reconcile_attempt_at: null,
    next_reconcile_attempt_at: null,
    last_reconcile_error: null,
    created_at: "2026-01-01T00:00:00.000Z",
    paid_at: null,
    failed_at: null,
    ...overrides,
  };
}

function createStore(initial: ZohoInvoiceAuthorizationChargeRow) {
  let row = { ...initial };
  const eventIds = new Set<string>();

  const client = {
    from(table: string) {
      if (table === "zoho_invoice_authorization_charges") {
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
          update: (patch: Partial<ZohoInvoiceAuthorizationChargeRow>) => ({
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

      if (table === "zoho_invoice_authorization_charge_events") {
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

function sampleCharge(overrides: Partial<PaystackChargeSuccess> = {}): PaystackChargeSuccess {
  return {
    reference: "zia_INV_001602_ab12cd34",
    amountCents: 10_000,
    providerEventId: "paystack:auth-charge:charge.success:9001",
    transactionId: 9001,
    paystackStatus: "success",
    metadata: {
      source: "zoho_invoice_authorization_charge",
      authorization_charge_id: "charge-1",
    },
    ...overrides,
  };
}

describe("processZohoInvoiceAuthorizationChargeSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(paystackVerifyTransaction).mockResolvedValue({
      status: true,
      message: "ok",
      data: {
        id: 9001,
        status: "success",
        reference: "zia_INV_001602_ab12cd34",
        amount: 10_000,
        currency: "ZAR",
      },
    });
    vi.mocked(createZohoCustomerPaymentForInvoice).mockResolvedValue({
      ok: true,
      zohoPaymentId: "zoho-payment-1",
      zohoStatus: "success",
    });
  });

  it("verifies Paystack and marks charge paid", async () => {
    const store = createStore(sampleRow());
    requireServiceRoleClientMock.mockReturnValue(store.client);

    const result = await processZohoInvoiceAuthorizationChargeSuccess(sampleCharge(), "charge.success");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.handled) return;
    expect(result.status).toBe("paid");
    expect(store.getRow().zoho_payment_id).toBe("zoho-payment-1");
  });

  it("skips duplicate Zoho payment when already paid", async () => {
    const store = createStore(
      sampleRow({ status: "paid", zoho_payment_id: "existing-zoho-payment" }),
    );
    requireServiceRoleClientMock.mockReturnValue(store.client);

    const result = await processZohoInvoiceAuthorizationChargeSuccess(sampleCharge(), "charge.success");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.handled) return;
    expect(result.idempotent).toBe(true);
    expect(createZohoCustomerPaymentForInvoice).not.toHaveBeenCalled();
  });

  it("does not call Zoho on amount mismatch", async () => {
    vi.mocked(paystackVerifyTransaction).mockResolvedValue({
      status: true,
      message: "ok",
      data: {
        id: 9001,
        status: "success",
        reference: "zia_INV_001602_ab12cd34",
        amount: 9_000,
        currency: "ZAR",
      },
    });
    const store = createStore(sampleRow());
    requireServiceRoleClientMock.mockReturnValue(store.client);

    const result = await processZohoInvoiceAuthorizationChargeSuccess(sampleCharge(), "charge.success");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.handled) return;
    expect(result.status).toBe("zoho_reconcile_failed");
    expect(createZohoCustomerPaymentForInvoice).not.toHaveBeenCalled();
  });

  it("marks reconcile pending when Zoho fails", async () => {
    vi.mocked(createZohoCustomerPaymentForInvoice).mockResolvedValue({
      ok: false,
      code: "ZOHO_API_ERROR",
      retryable: true,
    });
    const store = createStore(sampleRow());
    requireServiceRoleClientMock.mockReturnValue(store.client);

    const result = await processZohoInvoiceAuthorizationChargeSuccess(sampleCharge(), "charge.success");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.handled) return;
    expect(result.status).toBe("zoho_reconcile_pending");
  });
});
