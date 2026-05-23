import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ZohoInvoicePaymentRow } from "@/lib/database/types";
import { PaystackApiError } from "@/features/payments/server/paystackClient";
import type { PaystackChargeSuccess } from "@/features/payments/server/paystackTypes";
import { processZohoInvoiceChargeSuccess } from "./processZohoInvoiceChargeSuccess";

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

vi.mock("./captureReusableAuthorization", () => ({
  captureReusableAuthorization: vi.fn().mockResolvedValue({
    outcome: "not_requested",
    saved: false,
  }),
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
    eventIds,
  };
}

function sampleCharge(overrides: Partial<PaystackChargeSuccess> = {}): PaystackChargeSuccess {
  return {
    reference: "zi_INV_001602_ab12cd34",
    amountCents: 10_000,
    providerEventId: "paystack:txn:9001",
    transactionId: 9001,
    metadata: {
      source: "zoho_invoice",
      zoho_invoice_payment_id: "pay-1",
    },
    ...overrides,
  };
}

describe("processZohoInvoiceChargeSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks paid after verify and Zoho customer payment creation", async () => {
    const { client, getRow } = createStore(sampleRow());
    requireServiceRoleClientMock.mockReturnValue(client);

    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockResolvedValue({
      status: true,
      message: "ok",
      data: {
        id: 9001,
        status: "success",
        reference: "zi_INV_001602_ab12cd34",
        amount: 10_000,
        currency: "ZAR",
      },
    });

    const zohoPayments = await import("@/lib/zoho/customerPayments");
    vi.mocked(zohoPayments.createZohoCustomerPaymentForInvoice).mockResolvedValue({
      ok: true,
      zohoPaymentId: "zoho-payment-1",
      zohoStatus: "success",
    });

    const result = await processZohoInvoiceChargeSuccess(sampleCharge(), "charge.success", client);
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("paid");
      expect(result.idempotent).toBe(false);
    }
    expect(getRow().status).toBe("paid");
    expect(getRow().zoho_payment_id).toBe("zoho-payment-1");
  });

  it("returns idempotent for duplicate webhook when already paid", async () => {
    const { client } = createStore(
      sampleRow({
        status: "paid",
        zoho_payment_id: "zoho-payment-1",
        paid_at: "2026-01-02T00:00:00.000Z",
      }),
    );
    requireServiceRoleClientMock.mockReturnValue(client);

    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockResolvedValue({
      status: true,
      message: "ok",
      data: {
        id: 9001,
        status: "success",
        reference: "zi_INV_001602_ab12cd34",
        amount: 10_000,
        currency: "ZAR",
      },
    });

    const zohoPayments = await import("@/lib/zoho/customerPayments");
    const zohoSpy = vi.mocked(zohoPayments.createZohoCustomerPaymentForInvoice);

    const result = await processZohoInvoiceChargeSuccess(sampleCharge(), "charge.success", client);
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.idempotent).toBe(true);
    }
    expect(zohoSpy).not.toHaveBeenCalled();
  });

  it("does not create second Zoho payment when zoho_payment_id already exists", async () => {
    const { client } = createStore(
      sampleRow({
        status: "zoho_reconcile_pending",
        zoho_payment_id: "zoho-payment-existing",
      }),
    );
    requireServiceRoleClientMock.mockReturnValue(client);

    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockResolvedValue({
      status: true,
      message: "ok",
      data: {
        id: 9001,
        status: "success",
        reference: "zi_INV_001602_ab12cd34",
        amount: 10_000,
        currency: "ZAR",
      },
    });

    const zohoPayments = await import("@/lib/zoho/customerPayments");
    const zohoSpy = vi.mocked(zohoPayments.createZohoCustomerPaymentForInvoice);

    const result = await processZohoInvoiceChargeSuccess(sampleCharge(), "charge.success", client);
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("paid");
      expect(result.idempotent).toBe(true);
    }
    expect(zohoSpy).not.toHaveBeenCalled();
  });

  it("handles missing payment row safely", async () => {
    const { client } = createStore(sampleRow({ paystack_reference: "other_ref" }));
    requireServiceRoleClientMock.mockReturnValue(client);

    const result = await processZohoInvoiceChargeSuccess(
      sampleCharge({
        reference: "missing_ref",
        metadata: { source: "zoho_invoice" },
      }),
      "charge.success",
      client,
    );

    expect(result).toEqual({
      ok: true,
      handled: false,
      reason: "zoho_invoice_payment_not_found",
    });
  });

  it("sets reconcile pending when Paystack verify fails", async () => {
    const { client, getRow } = createStore(sampleRow());
    requireServiceRoleClientMock.mockReturnValue(client);

    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockRejectedValue(
      new PaystackApiError(502, "verify failed"),
    );

    const zohoPayments = await import("@/lib/zoho/customerPayments");
    const zohoSpy = vi.mocked(zohoPayments.createZohoCustomerPaymentForInvoice);

    const result = await processZohoInvoiceChargeSuccess(sampleCharge(), "charge.success", client);
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("zoho_reconcile_pending");
    }
    expect(getRow().status).toBe("zoho_reconcile_pending");
    expect(zohoSpy).not.toHaveBeenCalled();
  });

  it("sets reconcile failed on amount mismatch without calling Zoho", async () => {
    const { client, getRow } = createStore(sampleRow());
    requireServiceRoleClientMock.mockReturnValue(client);

    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockResolvedValue({
      status: true,
      message: "ok",
      data: {
        id: 9001,
        status: "success",
        reference: "zi_INV_001602_ab12cd34",
        amount: 9_999,
        currency: "ZAR",
      },
    });

    const zohoPayments = await import("@/lib/zoho/customerPayments");
    const zohoSpy = vi.mocked(zohoPayments.createZohoCustomerPaymentForInvoice);

    const result = await processZohoInvoiceChargeSuccess(sampleCharge(), "charge.success", client);
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("zoho_reconcile_failed");
    }
    expect(getRow().status).toBe("zoho_reconcile_failed");
    expect(zohoSpy).not.toHaveBeenCalled();
  });

  it("sets reconcile failed on currency mismatch without calling Zoho", async () => {
    const { client, getRow } = createStore(sampleRow());
    requireServiceRoleClientMock.mockReturnValue(client);

    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockResolvedValue({
      status: true,
      message: "ok",
      data: {
        id: 9001,
        status: "success",
        reference: "zi_INV_001602_ab12cd34",
        amount: 10_000,
        currency: "USD",
      },
    });

    const zohoPayments = await import("@/lib/zoho/customerPayments");
    const zohoSpy = vi.mocked(zohoPayments.createZohoCustomerPaymentForInvoice);

    const result = await processZohoInvoiceChargeSuccess(sampleCharge(), "charge.success", client);
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("zoho_reconcile_failed");
    }
    expect(getRow().status).toBe("zoho_reconcile_failed");
    expect(zohoSpy).not.toHaveBeenCalled();
  });

  it("sets reconcile pending when Zoho API fails after Paystack success", async () => {
    const { client, getRow } = createStore(sampleRow());
    requireServiceRoleClientMock.mockReturnValue(client);

    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockResolvedValue({
      status: true,
      message: "ok",
      data: {
        id: 9001,
        status: "success",
        reference: "zi_INV_001602_ab12cd34",
        amount: 10_000,
        currency: "ZAR",
      },
    });

    const zohoPayments = await import("@/lib/zoho/customerPayments");
    vi.mocked(zohoPayments.createZohoCustomerPaymentForInvoice).mockResolvedValue({
      ok: false,
      code: "ZOHO_HTTP_ERROR",
      retryable: true,
    });

    const result = await processZohoInvoiceChargeSuccess(sampleCharge(), "charge.success", client);
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("zoho_reconcile_pending");
    }
    expect(getRow().status).toBe("zoho_reconcile_pending");
  });

  it("retries pending row and marks paid on successful Zoho reconcile", async () => {
    const { client, getRow } = createStore(
      sampleRow({ status: "zoho_reconcile_pending", paystack_status: "success" }),
    );
    requireServiceRoleClientMock.mockReturnValue(client);

    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockResolvedValue({
      status: true,
      message: "ok",
      data: {
        id: 9001,
        status: "success",
        reference: "zi_INV_001602_ab12cd34",
        amount: 10_000,
        currency: "ZAR",
      },
    });

    const zohoPayments = await import("@/lib/zoho/customerPayments");
    vi.mocked(zohoPayments.createZohoCustomerPaymentForInvoice).mockResolvedValue({
      ok: true,
      zohoPaymentId: "zoho-payment-retry",
      zohoStatus: "success",
    });

    const result = await processZohoInvoiceChargeSuccess(sampleCharge(), "charge.success", client);
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("paid");
    }
    expect(getRow().status).toBe("paid");
    expect(getRow().zoho_payment_id).toBe("zoho-payment-retry");
  });

  it("continues invoice reconciliation when authorization capture throws", async () => {
    const { client, getRow } = createStore(sampleRow());
    requireServiceRoleClientMock.mockReturnValue(client);

    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockResolvedValue({
      status: true,
      message: "ok",
      data: {
        id: 9001,
        status: "success",
        reference: "zi_INV_001602_ab12cd34",
        amount: 10_000,
        currency: "ZAR",
      },
    });

    const capture = await import("./captureReusableAuthorization");
    vi.mocked(capture.captureReusableAuthorization).mockRejectedValue(new Error("capture failed"));

    const zohoPayments = await import("@/lib/zoho/customerPayments");
    vi.mocked(zohoPayments.createZohoCustomerPaymentForInvoice).mockResolvedValue({
      ok: true,
      zohoPaymentId: "zoho-payment-1",
      zohoStatus: "success",
    });

    const result = await processZohoInvoiceChargeSuccess(sampleCharge(), "charge.success", client);
    expect(result.ok).toBe(true);
    if (result.ok && result.handled) {
      expect(result.status).toBe("paid");
    }
    expect(getRow().status).toBe("paid");
  });
});
