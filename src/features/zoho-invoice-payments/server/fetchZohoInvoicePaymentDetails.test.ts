import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchZohoInvoicePaymentDetails } from "./fetchZohoInvoicePaymentDetails";
import { ZOHO_API_LATENCY_WARNING_MS } from "./zohoInvoiceFetchTiming";
import { publicMessageForZohoInvoiceStatus } from "./zohoInvoicePublicMessages";

const getZohoInvoiceByNumberMock = vi.fn();
const logEventMock = vi.fn();

vi.mock("@/lib/zoho/invoices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/zoho/invoices")>();
  return {
    ...actual,
    getZohoInvoiceByNumber: (...args: unknown[]) => getZohoInvoiceByNumberMock(...args),
  };
});

vi.mock("@/lib/zoho/zohoInvoicePaymentLogger", () => ({
  logZohoInvoicePaymentEvent: (...args: unknown[]) => logEventMock(...args),
}));

function expectLogged(event: string) {
  expect(logEventMock.mock.calls.some(([loggedEvent]) => loggedEvent === event)).toBe(true);
}

describe("fetchZohoInvoicePaymentDetails", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    getZohoInvoiceByNumberMock.mockReset();
    logEventMock.mockReset();
    process.env.ZOHO_BOOKS_ENABLED = "true";
    process.env.ZOHO_BOOKS_ORGANIZATION_ID = "org_test";
    process.env.ZOHO_CLIENT_ID = "client_test";
    process.env.ZOHO_CLIENT_SECRET = "secret_test";
    process.env.ZOHO_REFRESH_TOKEN = "refresh_test";
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    vi.restoreAllMocks();
  });

  it("logs invoice_number_invalid for malformed input", async () => {
    const result = await fetchZohoInvoicePaymentDetails("../bad");
    expect(result.ok).toBe(false);
    if (result.ok || !("code" in result)) return;
    expect(result.code).toBe("INVALID_INVOICE_NUMBER");
    expectLogged("invoice_number_invalid");
  });

  it("returns not_configured when invoice payments feature flag is disabled", async () => {
    process.env.ZOHO_INVOICE_PAYMENTS_ENABLED = "false";
    const result = await fetchZohoInvoicePaymentDetails("inv-001602");
    expect(result.ok).toBe(false);
    if (result.ok || "code" in result) return;
    expect(result.status).toBe("not_configured");
    expect(getZohoInvoiceByNumberMock).not.toHaveBeenCalled();
  });

  it("returns safe not_configured response and logs zoho_not_configured", async () => {
    delete process.env.ZOHO_CLIENT_ID;
    const result = await fetchZohoInvoicePaymentDetails("inv-001602");
    expect(result).toEqual({
      ok: false,
      status: "not_configured",
      message: publicMessageForZohoInvoiceStatus("not_configured"),
      invoiceNumber: "INV-001602",
    });
    expectLogged("zoho_not_configured");
  });

  it("logs fetch lifecycle events on success", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoice_id: "1",
        invoice_number: "INV-001602",
        customer_name: "Jane",
        balance: 100,
        currency_code: "ZAR",
        due_date: "2026-06-01",
        status: "sent",
        line_items: [],
      },
    });

    const result = await fetchZohoInvoicePaymentDetails("inv-001602");
    expect(result.ok).toBe(true);
    expectLogged("zoho_invoice_fetch_started");
    expectLogged("zoho_invoice_fetch_succeeded");
    expectLogged("zoho_invoice_status_mapped");
  });

  it("returns safe not_found response and logs zoho_invoice_not_found", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const result = await fetchZohoInvoicePaymentDetails("INV-404");
    expect(result).toEqual({
      ok: false,
      status: "not_found",
      message: publicMessageForZohoInvoiceStatus("not_found"),
      invoiceNumber: "INV-404",
    });
    expectLogged("zoho_invoice_not_found");
  });

  it("returns safe error response and logs zoho_invoice_fetch_failed", async () => {
    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: false,
      code: "API_ERROR",
      retryable: true,
    });
    const result = await fetchZohoInvoicePaymentDetails("INV-500");
    expect(result).toEqual({
      ok: false,
      status: "error",
      message: publicMessageForZohoInvoiceStatus("error"),
      invoiceNumber: "INV-500",
    });
    expectLogged("zoho_invoice_fetch_failed");
    if (!result.ok && "message" in result) {
      expect(result.message).not.toMatch(/Zoho|API_ERROR|HTTP/i);
    }
  });

  it("logs zoho_api_latency_warning when fetch exceeds threshold", async () => {
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(ZOHO_API_LATENCY_WARNING_MS + 1);

    getZohoInvoiceByNumberMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoice_id: "1",
        invoice_number: "INV-SLOW",
        balance: 10,
        status: "sent",
      },
    });

    await fetchZohoInvoicePaymentDetails("INV-SLOW");
    expectLogged("zoho_api_latency_warning");
  });
});
