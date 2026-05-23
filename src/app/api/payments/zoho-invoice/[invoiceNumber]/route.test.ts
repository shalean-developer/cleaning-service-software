import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { publicMessageForZohoInvoiceStatus } from "@/features/zoho-invoice-payments/server/zohoInvoicePublicMessages";

const fetchDetailsMock = vi.fn();

vi.mock("@/features/zoho-invoice-payments/server/fetchZohoInvoicePaymentDetails", () => ({
  fetchZohoInvoicePaymentDetails: (...args: unknown[]) => fetchDetailsMock(...args),
}));

describe("GET /api/payments/zoho-invoice/[invoiceNumber]", () => {
  beforeEach(() => {
    fetchDetailsMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns safe invoice DTO for payable invoices", async () => {
    fetchDetailsMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoiceNumber: "INV-001602",
        customerName: "Jane Doe",
        amountDueCents: 150_000,
        currency: "ZAR",
        dueDate: "2026-06-15",
        lineItems: [],
        status: "payable",
      },
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ invoiceNumber: "inv-001602" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      invoice: expect.objectContaining({
        invoiceNumber: "INV-001602",
        status: "payable",
        amountDueCents: 150_000,
      }),
    });
  });

  it("returns 400 for invalid invoice numbers", async () => {
    fetchDetailsMock.mockResolvedValue({
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
      message: "Invoice number format is invalid.",
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ invoiceNumber: "../bad" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_INVOICE_NUMBER");
  });

  it("returns safe not_found response without Zoho internals", async () => {
    fetchDetailsMock.mockResolvedValue({
      ok: false,
      status: "not_found",
      message: publicMessageForZohoInvoiceStatus("not_found"),
      invoiceNumber: "INV-404",
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ invoiceNumber: "INV-404" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      status: "not_found",
      message: publicMessageForZohoInvoiceStatus("not_found"),
    });
    expect(JSON.stringify(body)).not.toMatch(/zoho|oauth|token|secret/i);
  });

  it("returns safe error response without internal Zoho details", async () => {
    fetchDetailsMock.mockResolvedValue({
      ok: false,
      status: "error",
      message: publicMessageForZohoInvoiceStatus("error"),
      invoiceNumber: "INV-500",
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ invoiceNumber: "INV-500" }),
    });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.message).toBe(publicMessageForZohoInvoiceStatus("error"));
    expect(JSON.stringify(body)).not.toMatch(/ZOHO_|HTTP|oauth/i);
  });

  it("returns safe not_configured response", async () => {
    fetchDetailsMock.mockResolvedValue({
      ok: false,
      status: "not_configured",
      message: publicMessageForZohoInvoiceStatus("not_configured"),
      invoiceNumber: "INV-001",
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ invoiceNumber: "INV-001" }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      ok: false,
      status: "not_configured",
      message: publicMessageForZohoInvoiceStatus("not_configured"),
    });
  });
});
