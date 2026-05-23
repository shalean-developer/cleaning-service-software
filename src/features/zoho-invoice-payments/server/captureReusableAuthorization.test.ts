import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ZohoInvoicePaymentRow } from "@/lib/database/types";
import { captureReusableAuthorization } from "./captureReusableAuthorization";
import { buildSavePaymentMethodConsentMetadata } from "./zohoInvoiceSavePaymentMethodConsent";

const findDefaultMock = vi.fn();
const insertMethodMock = vi.fn();
const mergeMetadataMock = vi.fn();
const logEventMock = vi.fn();

vi.mock("./zohoInvoicePaymentMethodRepository", () => ({
  findActiveDefaultZohoInvoicePaymentMethodByEmail: (...args: unknown[]) =>
    findDefaultMock(...args),
  insertZohoInvoicePaymentMethod: (...args: unknown[]) => insertMethodMock(...args),
}));

vi.mock("./zohoInvoicePaymentRepository", () => ({
  mergeZohoInvoicePaymentMetadata: (...args: unknown[]) => mergeMetadataMock(...args),
}));

vi.mock("@/lib/zoho/zohoInvoicePaymentLogger", () => ({
  logZohoInvoicePaymentEvent: (...args: unknown[]) => logEventMock(...args),
}));

function samplePaymentRow(
  overrides: Partial<ZohoInvoicePaymentRow> = {},
): ZohoInvoicePaymentRow {
  return {
    id: "pay-1",
    invoice_number: "INV-001602",
    zoho_invoice_id: "zoho-inv-1",
    customer_name: "Jane Doe",
    customer_email: "jane@example.com",
    amount_cents: 10_000,
    currency: "ZAR",
    paystack_reference: "zi_test",
    paystack_access_code: null,
    paystack_authorization_url: null,
    paystack_status: "success",
    zoho_payment_id: null,
    zoho_status: null,
    status: "pending_paystack",
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

const client = {} as SupabaseClient<Database>;

describe("captureReusableAuthorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findDefaultMock.mockResolvedValue(null);
    insertMethodMock.mockResolvedValue({
      row: { id: "method-1" },
      duplicate: false,
    });
  });

  it("skips when consent was not requested", async () => {
    const result = await captureReusableAuthorization(
      samplePaymentRow(),
      { id: 1, status: "success", reference: "zi_test", amount: 10_000 },
      client,
    );

    expect(result).toEqual({ outcome: "not_requested", saved: false });
    expect(insertMethodMock).not.toHaveBeenCalled();
    expect(mergeMetadataMock).toHaveBeenCalledWith(
      "pay-1",
      { authorization_capture_outcome: "not_requested" },
      client,
    );
  });

  it("skips when authorization is not reusable", async () => {
    const result = await captureReusableAuthorization(
      samplePaymentRow({
        metadata: buildSavePaymentMethodConsentMetadata(),
      }),
      {
        id: 1,
        status: "success",
        reference: "zi_test",
        amount: 10_000,
        authorization: { reusable: false, authorization_code: "AUTH_123" },
      },
      client,
    );

    expect(result).toEqual({ outcome: "not_reusable", saved: false });
    expect(insertMethodMock).not.toHaveBeenCalled();
  });

  it("skips when authorization_code is missing", async () => {
    const result = await captureReusableAuthorization(
      samplePaymentRow({
        metadata: buildSavePaymentMethodConsentMetadata(),
      }),
      {
        id: 1,
        status: "success",
        reference: "zi_test",
        amount: 10_000,
        authorization: { reusable: true },
      },
      client,
    );

    expect(result).toEqual({ outcome: "missing_authorization_code", saved: false });
    expect(insertMethodMock).not.toHaveBeenCalled();
  });

  it("saves reusable authorization when consent requested", async () => {
    const result = await captureReusableAuthorization(
      samplePaymentRow({
        metadata: buildSavePaymentMethodConsentMetadata(),
      }),
      {
        id: 1,
        status: "success",
        reference: "zi_test",
        amount: 10_000,
        authorization: {
          reusable: true,
          authorization_code: "AUTH_123",
          card_type: "visa",
          last4: "1234",
          exp_month: "12",
          exp_year: "2030",
          signature: "SIG_123",
        },
        customer: { customer_code: "CUS_123" },
      },
      client,
    );

    expect(result).toEqual({ outcome: "saved", saved: true });
    expect(insertMethodMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationCode: "AUTH_123",
        cardType: "visa",
        last4: "1234",
        isDefault: true,
      }),
      client,
    );
  });

  it("treats duplicate authorization_code as idempotent save", async () => {
    insertMethodMock.mockResolvedValue({
      row: { id: "method-existing" },
      duplicate: true,
    });

    const result = await captureReusableAuthorization(
      samplePaymentRow({
        metadata: buildSavePaymentMethodConsentMetadata(),
      }),
      {
        id: 1,
        status: "success",
        reference: "zi_test",
        amount: 10_000,
        authorization: {
          reusable: true,
          authorization_code: "AUTH_DUP",
        },
      },
      client,
    );

    expect(result.saved).toBe(true);
    expect(logEventMock).toHaveBeenCalledWith(
      "zoho_invoice_payment_method_duplicate",
      expect.any(Object),
    );
  });

  it("returns failed outcome when persistence throws", async () => {
    insertMethodMock.mockRejectedValue(new Error("db down"));

    const result = await captureReusableAuthorization(
      samplePaymentRow({
        metadata: buildSavePaymentMethodConsentMetadata(),
      }),
      {
        id: 1,
        status: "success",
        reference: "zi_test",
        amount: 10_000,
        authorization: {
          reusable: true,
          authorization_code: "AUTH_FAIL",
        },
      },
      client,
    );

    expect(result).toEqual({ outcome: "failed", saved: false });
  });
});
