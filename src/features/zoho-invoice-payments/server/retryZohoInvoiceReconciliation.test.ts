import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ZohoInvoicePaymentRow } from "@/lib/database/types";
import { PaystackApiError } from "@/features/payments/server/paystackClient";
import { retryZohoInvoiceReconciliation } from "./retryZohoInvoiceReconciliation";

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

const listPendingMock = vi.fn();

vi.mock("./zohoInvoicePaymentRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./zohoInvoicePaymentRepository")>();
  return {
    ...actual,
    listZohoInvoicePaymentsPendingReconciliation: (...args: unknown[]) =>
      listPendingMock(...args),
  };
});

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
    paystack_status: "success",
    zoho_payment_id: null,
    zoho_status: null,
    status: "zoho_reconcile_pending",
    idempotency_key: "key-1",
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    paid_at: null,
    reconcile_attempts: 0,
    last_reconcile_attempt_at: null,
    next_reconcile_attempt_at: null,
    last_reconcile_error: null,
    ...overrides,
  };
}

function createStore(rows: ZohoInvoicePaymentRow[]) {
  const store = new Map(rows.map((row) => [row.id, { ...row }]));

  const client = {
    from(table: string) {
      if (table !== "zoho_invoice_payments") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: (_columns?: string, options?: { count?: string; head?: boolean }) => {
          if (options?.head) {
            return {
              eq: async () => ({ count: 0, error: null }),
            };
          }

          return {
            eq: (column: string, value: string | number) => {
              const chain = {
                lt: () => chain,
                or: () => chain,
                in: () => chain,
                order: () => ({
                  limit: async () => ({
                    data: [...store.values()].filter((row) => {
                      if (column === "status") return row.status === value;
                      if (column === "id") return row.id === value;
                      if (column === "paystack_reference") return row.paystack_reference === value;
                      return false;
                    }),
                    error: null,
                  }),
                }),
                maybeSingle: async () => {
                  if (column === "id") {
                    return { data: store.get(String(value)) ?? null, error: null };
                  }
                  return { data: null, error: null };
                },
              };
              return chain;
            },
            in: () => ({
              order: () => ({
                limit: async () => ({ data: [...store.values()], error: null }),
              }),
            }),
            order: () => ({
              limit: async () => ({ data: [...store.values()], error: null }),
            }),
          };
        },
        update: (patch: Partial<ZohoInvoicePaymentRow>) => ({
          eq: (_column: string, id: string) => ({
            select: () => ({
              single: async () => {
                const row = store.get(id);
                if (!row) return { data: null, error: { message: "not found" } };
                const next = { ...row, ...patch, id };
                store.set(id, next);
                return { data: next, error: null };
              },
            }),
          }),
        }),
      };
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    getRow: (id: string) => store.get(id),
    listPending: () =>
      [...store.values()].filter((row) => row.status === "zoho_reconcile_pending"),
  };
}

describe("retryZohoInvoiceReconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPendingMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty summary when no pending rows", async () => {
    listPendingMock.mockResolvedValue([]);
    const { client } = createStore([]);
    const summary = await retryZohoInvoiceReconciliation({}, client);
    expect(summary).toEqual({
      scanned: 0,
      retried: 0,
      paid: 0,
      pending: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    });
  });

  it("marks paid on successful retry", async () => {
    const { client, getRow } = createStore([sampleRow()]);
    listPendingMock.mockResolvedValue([sampleRow()]);
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

    const summary = await retryZohoInvoiceReconciliation({}, client);
    expect(summary.paid).toBe(1);
    expect(getRow("pay-1")?.status).toBe("paid");
    expect(summary.errors).toEqual([]);
  });

  it("skips already paid rows", async () => {
    const paidRow = sampleRow({
      status: "paid",
      zoho_payment_id: "zoho-payment-1",
      paid_at: "2026-01-02T00:00:00.000Z",
    });
    const { client } = createStore([paidRow]);
    listPendingMock.mockResolvedValue([paidRow]);

    const summary = await retryZohoInvoiceReconciliation({}, client);
    expect(summary.skipped).toBe(1);
  });

  it("schedules retry on Paystack verify network failure", async () => {
    const { client, getRow } = createStore([sampleRow()]);
    listPendingMock.mockResolvedValue([sampleRow()]);
    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockRejectedValue(
      new PaystackApiError(502, "verify failed"),
    );

    const summary = await retryZohoInvoiceReconciliation({}, client);
    expect(summary.pending).toBe(1);
    expect(getRow("pay-1")?.reconcile_attempts).toBe(1);
    expect(getRow("pay-1")?.next_reconcile_attempt_at).toBeTruthy();
    expect(summary.errors).toEqual([]);
  });

  it("schedules retry on Zoho API failure", async () => {
    const { client, getRow } = createStore([sampleRow()]);
    listPendingMock.mockResolvedValue([sampleRow()]);
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

    const summary = await retryZohoInvoiceReconciliation({}, client);
    expect(summary.pending).toBe(1);
    expect(getRow("pay-1")?.last_reconcile_error).toBe("ZOHO_HTTP_ERROR");
  });

  it("marks reconcile_failed on amount mismatch", async () => {
    const { client, getRow } = createStore([sampleRow()]);
    listPendingMock.mockResolvedValue([sampleRow()]);
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

    const summary = await retryZohoInvoiceReconciliation({}, client);
    expect(summary.failed).toBe(1);
    expect(getRow("pay-1")?.status).toBe("zoho_reconcile_failed");
  });

  it("marks reconcile_failed on currency mismatch", async () => {
    const { client, getRow } = createStore([sampleRow()]);
    listPendingMock.mockResolvedValue([sampleRow()]);
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

    const summary = await retryZohoInvoiceReconciliation({}, client);
    expect(summary.failed).toBe(1);
    expect(getRow("pay-1")?.status).toBe("zoho_reconcile_failed");
  });

  it("marks exhausted after max attempts", async () => {
    const pendingRow = sampleRow({
      reconcile_attempts: 4,
      last_reconcile_error: "ZOHO_HTTP_ERROR",
    });
    const { client, getRow } = createStore([pendingRow]);
    listPendingMock.mockResolvedValue([pendingRow]);
    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockRejectedValue(
      new PaystackApiError(502, "verify failed"),
    );

    const summary = await retryZohoInvoiceReconciliation({}, client);
    expect(summary.failed).toBe(1);
    expect(getRow("pay-1")?.status).toBe("zoho_reconcile_failed");
    expect(getRow("pay-1")?.reconcile_attempts).toBe(5);
  });

  it("summary never includes raw provider error details", async () => {
    const { client } = createStore([sampleRow()]);
    listPendingMock.mockResolvedValue([sampleRow()]);
    const paystackClient = await import("@/features/payments/server/paystackClient");
    vi.mocked(paystackClient.paystackVerifyTransaction).mockRejectedValue(
      new PaystackApiError(502, "raw paystack secret payload"),
    );

    const summary = await retryZohoInvoiceReconciliation({}, client);
    expect(JSON.stringify(summary)).not.toContain("raw paystack secret payload");
  });
});
