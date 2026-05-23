import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeZohoInvoicePayment } from "./initializeZohoInvoicePayment";

const getZohoInvoiceByNumberMock = vi.fn();
const findActiveMock = vi.fn();
const createAttemptMock = vi.fn();
const updateInitializedMock = vi.fn();
const cancelActiveMock = vi.fn();
const markFailedMock = vi.fn();
const paystackInitMock = vi.fn();
const logEventMock = vi.fn();

vi.mock("@/lib/zoho/invoices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/zoho/invoices")>();
  return {
    ...actual,
    getZohoInvoiceByNumber: (...args: unknown[]) => getZohoInvoiceByNumberMock(...args),
  };
});

vi.mock("./zohoInvoicePaymentRepository", () => ({
  findActiveZohoInvoicePaymentByInvoiceNumber: (...args: unknown[]) => findActiveMock(...args),
  createZohoInvoicePaymentAttempt: (...args: unknown[]) => createAttemptMock(...args),
  updateZohoInvoicePaymentPaystackInitialized: (...args: unknown[]) =>
    updateInitializedMock(...args),
  cancelActiveZohoInvoicePaymentAttempt: (...args: unknown[]) => cancelActiveMock(...args),
  markZohoInvoicePaymentInitializeFailed: (...args: unknown[]) => markFailedMock(...args),
  mergeZohoInvoicePaymentMetadata: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/payments/server/paystackClient", () => ({
  paystackInitializeTransaction: (...args: unknown[]) => paystackInitMock(...args),
  PaystackApiError: class PaystackApiError extends Error {
    constructor(
      readonly statusCode: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock("@/lib/zoho/zohoInvoicePaymentLogger", () => ({
  logZohoInvoicePaymentEvent: (...args: unknown[]) => logEventMock(...args),
}));

describe("initializeZohoInvoicePayment", () => {
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
    process.env.APP_BASE_URL = "https://shalean.co.za";

    findActiveMock.mockResolvedValue(null);
    createAttemptMock.mockResolvedValue({
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      amount_cents: 10_000,
      currency: "ZAR",
    });
    updateInitializedMock.mockResolvedValue({});
    paystackInitMock.mockResolvedValue({
      data: {
        authorization_url: "https://checkout.paystack.com/test",
        access_code: "access-code",
        reference: "zi_INV_001602_aaaaaaaa",
      },
    });
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("rejects invalid invoice numbers", async () => {
    const result = await initializeZohoInvoicePayment("../bad");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_INVOICE_NUMBER");
  });

  it("blocks initialize when invoice payments feature flag is disabled", async () => {
    process.env.ZOHO_INVOICE_PAYMENTS_ENABLED = "false";
    const result = await initializeZohoInvoicePayment("inv-001602");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVOICE_PAYMENTS_DISABLED");
    expect(getZohoInvoiceByNumberMock).not.toHaveBeenCalled();
  });

  it("blocks when Zoho is not configured", async () => {
    delete process.env.ZOHO_CLIENT_ID;
    const result = await initializeZohoInvoicePayment("inv-001602");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_CONFIGURED");
  });

  it("blocks not found invoices", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const result = await initializeZohoInvoicePayment("INV-404");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });

  it("blocks paid invoices", async () => {
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
    const result = await initializeZohoInvoicePayment("INV-PAID");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_PAYABLE");
  });

  it("blocks void invoices", async () => {
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
    const result = await initializeZohoInvoicePayment("INV-VOID");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_PAYABLE");
  });

  it("blocks missing customer email", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoice_id: "1",
        invoice_number: "INV-NOEMAIL",
        balance: 100,
        status: "sent",
      },
    });
    const result = await initializeZohoInvoicePayment("INV-NOEMAIL");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("MISSING_CUSTOMER_EMAIL");
  });

  it("initializes Paystack with zoho_invoice metadata", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoice_id: "zoho-123",
        invoice_number: "INV-001602",
        email: "jane@example.com",
        balance: 100,
        currency_code: "ZAR",
        status: "sent",
      },
    });

    const result = await initializeZohoInvoicePayment("inv-001602");
    expect(result.ok).toBe(true);
    expect(paystackInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10_000,
        metadata: expect.objectContaining({
          source: "zoho_invoice",
          invoice_number: "INV-001602",
          zoho_invoice_id: "zoho-123",
        }),
      }),
    );
  });

  it("reuses pending checkout with same amount", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoice_id: "zoho-123",
        invoice_number: "INV-001602",
        email: "jane@example.com",
        balance: 100,
        status: "sent",
      },
    });
    findActiveMock.mockResolvedValue({
      id: "existing",
      amount_cents: 10_000,
      currency: "ZAR",
      paystack_authorization_url: "https://checkout.paystack.com/reuse",
      paystack_access_code: "reuse-code",
      paystack_reference: "zi_existing",
    });

    const result = await initializeZohoInvoicePayment("INV-001602");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.authorizationUrl).toBe("https://checkout.paystack.com/reuse");
    expect(createAttemptMock).not.toHaveBeenCalled();
  });

  it("stores consent metadata and Paystack metadata when requested", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoice_id: "zoho-123",
        invoice_number: "INV-001602",
        email: "jane@example.com",
        balance: 100,
        currency_code: "ZAR",
        status: "sent",
      },
    });

    const result = await initializeZohoInvoicePayment("inv-001602", {
      savePaymentMethodConsent: true,
    });
    expect(result.ok).toBe(true);
    expect(createAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          save_payment_method_requested: true,
          consent_text_version: expect.any(String),
          consent_text: expect.any(String),
        }),
      }),
    );
    expect(paystackInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          save_payment_method_requested: true,
          consent_text_version: expect.any(String),
        }),
      }),
    );
    expect(logEventMock).toHaveBeenCalledWith(
      "zoho_invoice_save_method_consent_requested",
      expect.any(Object),
    );
  });

  it("does not store consent metadata when saved methods feature flag is disabled", async () => {
    process.env.ZOHO_SAVED_METHODS_ENABLED = "false";
    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoice_id: "zoho-123",
        invoice_number: "INV-001602",
        email: "jane@example.com",
        balance: 100,
        currency_code: "ZAR",
        status: "sent",
      },
    });

    const result = await initializeZohoInvoicePayment("inv-001602", {
      savePaymentMethodConsent: true,
    });
    expect(result.ok).toBe(true);
    expect(createAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.not.objectContaining({
          save_payment_method_requested: true,
        }),
      }),
    );
    expect(paystackInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.not.objectContaining({
          save_payment_method_requested: true,
        }),
      }),
    );
  });

  it("marks attempt failed when Paystack initialize fails", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoice_id: "zoho-123",
        invoice_number: "INV-001602",
        email: "jane@example.com",
        balance: 100,
        status: "sent",
      },
    });
    paystackInitMock.mockRejectedValue(
      new (await import("@/features/payments/server/paystackClient")).PaystackApiError(
        502,
        "down",
      ),
    );

    const result = await initializeZohoInvoicePayment("INV-001602");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PAYSTACK_INIT_FAILED");
    expect(markFailedMock).toHaveBeenCalled();
  });
});
