import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_CHARGE_CONFIRM_PHRASE,
  adminChargeZohoInvoiceSavedMethod,
} from "./adminChargeZohoInvoiceSavedMethod";

const getZohoInvoiceByNumberMock = vi.fn();
const findPaymentMethodMock = vi.fn();
const findActiveChargeMock = vi.fn();
const createAttemptMock = vi.fn();
const updateReferenceMock = vi.fn();
const markSubmittedMock = vi.fn();
const markFailedMock = vi.fn();
const chargeSavedAuthorizationMock = vi.fn();
const logEventMock = vi.fn();

vi.mock("@/lib/zoho/invoices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/zoho/invoices")>();
  return {
    ...actual,
    getZohoInvoiceByNumber: (...args: unknown[]) => getZohoInvoiceByNumberMock(...args),
  };
});


vi.mock("./zohoInvoiceAuthorizationChargeRepository", () => ({
  createAuthorizationChargeAttempt: (...args: unknown[]) => createAttemptMock(...args),
  findActiveAuthorizationChargeByInvoiceNumber: (...args: unknown[]) =>
    findActiveChargeMock(...args),
  updateAuthorizationChargeReference: (...args: unknown[]) => updateReferenceMock(...args),
  markAuthorizationChargeSubmitted: (...args: unknown[]) => markSubmittedMock(...args),
  markAuthorizationChargeFailed: (...args: unknown[]) => markFailedMock(...args),
}));

vi.mock("./zohoInvoicePaymentMethodRepository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("./zohoInvoicePaymentMethodRepository")
  >();
  return {
    ...actual,
    findZohoInvoicePaymentMethodById: (...args: unknown[]) => findPaymentMethodMock(...args),
    markPaymentMethodLastUsed: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("./chargeSavedAuthorization", () => ({
  chargeSavedAuthorization: (...args: unknown[]) => chargeSavedAuthorizationMock(...args),
}));

vi.mock("@/lib/zoho/zohoInvoicePaymentLogger", () => ({
  logZohoInvoicePaymentEvent: (...args: unknown[]) => logEventMock(...args),
}));

const baseInput = {
  adminProfileId: "admin-1",
  invoiceNumber: "INV-001602",
  paymentMethodId: "pm-1",
  reason: "Customer approved phone charge for invoice INV-001602",
  confirmPhrase: ADMIN_CHARGE_CONFIRM_PHRASE,
};

const payableInvoice = {
  ok: true,
  invoice: {
    invoice_id: "zoho-123",
    invoice_number: "INV-001602",
    email: "jane@example.com",
    balance: 100,
    currency_code: "ZAR",
    status: "sent",
  },
};

const activeMethod = {
  id: "pm-1",
  customer_email: "jane@example.com",
  authorization_code: "AUTH_secret",
  reusable: true,
  revoked_at: null,
};

describe("adminChargeZohoInvoiceSavedMethod", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ZOHO_BOOKS_ENABLED = "true";
    process.env.ZOHO_BOOKS_ORGANIZATION_ID = "org";
    process.env.ZOHO_CLIENT_ID = "client";
    process.env.ZOHO_CLIENT_SECRET = "secret";
    process.env.ZOHO_REFRESH_TOKEN = "refresh";
    process.env.PAYSTACK_ENABLED = "true";
    process.env.PAYSTACK_SECRET_KEY = "sk_test";
    process.env.ZOHO_ADMIN_CARD_CHARGES_ENABLED = "true";

    getZohoInvoiceByNumberMock.mockResolvedValue(payableInvoice);
    findPaymentMethodMock.mockResolvedValue(activeMethod);
    findActiveChargeMock.mockResolvedValue(null);
    createAttemptMock.mockResolvedValue({
      id: "charge-1",
      status: "initialized",
    });
    updateReferenceMock.mockResolvedValue({
      id: "charge-1",
      status: "initialized",
    });
    markSubmittedMock.mockResolvedValue({
      id: "charge-1",
      status: "pending_webhook",
    });
    chargeSavedAuthorizationMock.mockResolvedValue({
      data: { status: "success", reference: "zia_INV_001602_charge1" },
    });
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("rejects invalid invoice numbers", async () => {
    const result = await adminChargeZohoInvoiceSavedMethod({
      ...baseInput,
      invoiceNumber: "../bad",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_INVOICE_NUMBER");
  });

  it("rejects missing reason", async () => {
    const result = await adminChargeZohoInvoiceSavedMethod({
      ...baseInput,
      reason: "short",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_REASON");
  });

  it("rejects wrong confirm phrase", async () => {
    const result = await adminChargeZohoInvoiceSavedMethod({
      ...baseInput,
      confirmPhrase: "CHARGE NOW",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_CONFIRM_PHRASE");
  });

  it("rejects when admin card charges feature flag is disabled", async () => {
    process.env.ZOHO_ADMIN_CARD_CHARGES_ENABLED = "false";
    const result = await adminChargeZohoInvoiceSavedMethod(baseInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ADMIN_CARD_CHARGES_DISABLED");
    expect(result.status).toBe(403);
    expect(getZohoInvoiceByNumberMock).not.toHaveBeenCalled();
  });

  it("rejects already-paid invoice", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoice_id: "1",
        invoice_number: "INV-PAID",
        email: "jane@example.com",
        balance: 0,
        status: "paid",
      },
    });
    const result = await adminChargeZohoInvoiceSavedMethod({
      ...baseInput,
      invoiceNumber: "INV-PAID",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_PAYABLE");
  });

  it("rejects void invoice", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoice_id: "1",
        invoice_number: "INV-VOID",
        email: "jane@example.com",
        balance: 100,
        status: "void",
      },
    });
    const result = await adminChargeZohoInvoiceSavedMethod({
      ...baseInput,
      invoiceNumber: "INV-VOID",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_PAYABLE");
  });

  it("rejects revoked payment method", async () => {
    findPaymentMethodMock.mockResolvedValue({
      ...activeMethod,
      revoked_at: "2026-01-01T00:00:00.000Z",
    });
    const result = await adminChargeZohoInvoiceSavedMethod(baseInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PAYMENT_METHOD_REVOKED");
  });

  it("rejects expired payment method", async () => {
    findPaymentMethodMock.mockResolvedValue({
      ...activeMethod,
      exp_month: "01",
      exp_year: "2020",
    });
    const result = await adminChargeZohoInvoiceSavedMethod(baseInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PAYMENT_METHOD_EXPIRED");
  });

  it("rejects non-reusable payment method", async () => {
    findPaymentMethodMock.mockResolvedValue({ ...activeMethod, reusable: false });
    const result = await adminChargeZohoInvoiceSavedMethod(baseInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PAYMENT_METHOD_NOT_REUSABLE");
  });

  it("rejects customer email mismatch", async () => {
    findPaymentMethodMock.mockResolvedValue({
      ...activeMethod,
      customer_email: "other@example.com",
    });
    const result = await adminChargeZohoInvoiceSavedMethod(baseInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("CUSTOMER_EMAIL_MISMATCH");
  });

  it("rejects active charge for same invoice", async () => {
    findActiveChargeMock.mockResolvedValue({ id: "existing" });
    const result = await adminChargeZohoInvoiceSavedMethod(baseInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ACTIVE_CHARGE_EXISTS");
  });

  it("uses live Zoho balance for amount", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoice_id: "zoho-123",
        invoice_number: "INV-001602",
        email: "jane@example.com",
        balance: 250.5,
        currency_code: "ZAR",
        status: "sent",
      },
    });

    const result = await adminChargeZohoInvoiceSavedMethod(baseInput);
    expect(result.ok).toBe(true);
    expect(createAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 25_050 }),
    );
    expect(chargeSavedAuthorizationMock).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 25_050 }),
    );
  });

  it("submits Paystack charge_authorization and returns safe response", async () => {
    const result = await adminChargeZohoInvoiceSavedMethod(baseInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reference).toMatch(/^zia_/);
    expect(result.amountCents).toBe(10_000);
    expect(result.status).toBe("pending_webhook");
    expect(chargeSavedAuthorizationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationCode: "AUTH_secret",
        invoiceNumber: "INV-001602",
        initiatedByAdminId: "admin-1",
      }),
    );
    expect(markSubmittedMock).toHaveBeenCalled();
  });
});
