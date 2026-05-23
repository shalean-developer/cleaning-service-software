import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSafeInvoiceFieldsFromZoho,
  getZohoInvoiceByNumber,
  resolveZohoInvoicePaymentStatus,
  zohoAmountToCents,
} from "./invoices";
import { resetZohoClientTokenCacheForTests } from "./zohoClient";

const zohoBooksFetchMock = vi.fn();

vi.mock("./zohoClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./zohoClient")>();
  return {
    ...actual,
    zohoBooksFetch: (...args: unknown[]) => zohoBooksFetchMock(...args),
  };
});

describe("zohoAmountToCents", () => {
  it("converts major currency units to integer cents", () => {
    expect(zohoAmountToCents(1500.5)).toBe(150_050);
    expect(zohoAmountToCents(0)).toBe(0);
    expect(zohoAmountToCents(null)).toBe(0);
  });
});

describe("resolveZohoInvoicePaymentStatus", () => {
  it("marks void and cancelled invoices as void", () => {
    expect(
      resolveZohoInvoicePaymentStatus({
        invoice_id: "1",
        invoice_number: "INV-1",
        status: "void",
        balance: 100,
      }),
    ).toBe("void");
    expect(
      resolveZohoInvoicePaymentStatus({
        invoice_id: "1",
        invoice_number: "INV-1",
        status: "cancelled",
        balance: 100,
      }),
    ).toBe("void");
  });

  it("marks zero balance or paid status as paid", () => {
    expect(
      resolveZohoInvoicePaymentStatus({
        invoice_id: "1",
        invoice_number: "INV-1",
        status: "paid",
        balance: 10,
      }),
    ).toBe("paid");
    expect(
      resolveZohoInvoicePaymentStatus({
        invoice_id: "1",
        invoice_number: "INV-1",
        status: "sent",
        balance: 0,
      }),
    ).toBe("paid");
  });

  it("marks positive balance as payable", () => {
    expect(
      resolveZohoInvoicePaymentStatus({
        invoice_id: "1",
        invoice_number: "INV-1",
        status: "sent",
        balance: 500,
      }),
    ).toBe("payable");
  });
});

describe("getZohoInvoiceByNumber", () => {
  beforeEach(() => {
    zohoBooksFetchMock.mockReset();
    resetZohoClientTokenCacheForTests();
  });

  afterEach(() => {
    resetZohoClientTokenCacheForTests();
  });

  it("returns invoice when Zoho responds with a match", async () => {
    zohoBooksFetchMock.mockResolvedValue({
      code: 0,
      invoices: [
        {
          invoice_id: "zoho-123",
          invoice_number: "INV-001602",
          customer_name: "Jane Doe",
          balance: 1500,
          currency_code: "ZAR",
          status: "sent",
          due_date: "2026-06-15",
          line_items: [{ name: "Deep clean", quantity: 1, item_total: 1500 }],
        },
      ],
    });

    const result = await getZohoInvoiceByNumber("INV-001602");
    expect(result).toEqual({
      ok: true,
      invoice: expect.objectContaining({
        invoice_id: "zoho-123",
        invoice_number: "INV-001602",
      }),
    });
    expect(zohoBooksFetchMock).toHaveBeenCalledWith(
      "/invoices?invoice_number=INV-001602",
      { method: "GET" },
    );
    expect(zohoBooksFetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to search_text when invoice_number returns no exact match", async () => {
    zohoBooksFetchMock
      .mockResolvedValueOnce({ code: 0, invoices: [] })
      .mockResolvedValueOnce({
        code: 0,
        invoices: [
          {
            invoice_id: "zoho-456",
            invoice_number: "INV-001602",
            customer_name: "Jane Doe",
            balance: 1500,
            currency_code: "ZAR",
            status: "sent",
            due_date: "2026-06-15",
            line_items: [{ name: "Deep clean", quantity: 1, item_total: 1500 }],
          },
        ],
      });

    const result = await getZohoInvoiceByNumber("inv-001602");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.invoice_id).toBe("zoho-456");
    expect(zohoBooksFetchMock).toHaveBeenNthCalledWith(
      1,
      "/invoices?invoice_number=INV-001602",
      { method: "GET" },
    );
    expect(zohoBooksFetchMock).toHaveBeenNthCalledWith(
      2,
      "/invoices?search_text=INV-001602",
      { method: "GET" },
    );
  });

  it("matches exact invoice_number when search_text returns multiple invoices", async () => {
    zohoBooksFetchMock
      .mockResolvedValueOnce({ code: 0, invoices: [] })
      .mockResolvedValueOnce({
        code: 0,
        invoices: [
          {
            invoice_id: "zoho-other",
            invoice_number: "INV-001600",
            balance: 100,
            line_items: [],
          },
          {
            invoice_id: "zoho-123",
            invoice_number: "INV-001602",
            balance: 1500,
            line_items: [{ name: "Deep clean", quantity: 1, item_total: 1500 }],
          },
        ],
      });

    const result = await getZohoInvoiceByNumber("INV-001602");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.invoice_id).toBe("zoho-123");
  });

  it("fetches full invoice by id when list response is summary-only", async () => {
    zohoBooksFetchMock
      .mockResolvedValueOnce({
        code: 0,
        invoices: [
          {
            invoice_id: "zoho-123",
            invoice_number: "INV-001602",
            balance: 1500,
            status: "sent",
          },
        ],
      })
      .mockResolvedValueOnce({
        code: 0,
        invoice: {
          invoice_id: "zoho-123",
          invoice_number: "INV-001602",
          customer_name: "Jane Doe",
          balance: 1500,
          currency_code: "ZAR",
          status: "sent",
          due_date: "2026-06-15",
          line_items: [{ name: "Deep clean", quantity: 1, item_total: 1500 }],
        },
      });

    const result = await getZohoInvoiceByNumber("INV-001602");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.line_items).toHaveLength(1);
    expect(zohoBooksFetchMock).toHaveBeenNthCalledWith(
      2,
      "/invoices/zoho-123",
      { method: "GET" },
    );
  });

  it("does not fall back to search_text when invoice_number lookup hits API error", async () => {
    zohoBooksFetchMock.mockRejectedValue(
      new (await import("./zohoClient")).ZohoApiError(500, "ZOHO_HTTP_ERROR", "down"),
    );

    const result = await getZohoInvoiceByNumber("INV-001602");
    expect(result).toEqual({ ok: false, code: "API_ERROR", retryable: true });
    expect(zohoBooksFetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns NOT_FOUND when invoice list is empty", async () => {
    zohoBooksFetchMock.mockResolvedValue({ code: 0, invoices: [] });
    const result = await getZohoInvoiceByNumber("INV-999");
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("returns API_ERROR when fetch throws", async () => {
    zohoBooksFetchMock.mockRejectedValue(
      new (await import("./zohoClient")).ZohoApiError(500, "ZOHO_HTTP_ERROR", "down"),
    );
    const result = await getZohoInvoiceByNumber("INV-001");
    expect(result).toEqual({ ok: false, code: "API_ERROR", retryable: true });
  });
});

describe("buildSafeInvoiceFieldsFromZoho", () => {
  it("maps line items and payable balance", () => {
    const fields = buildSafeInvoiceFieldsFromZoho({
      invoice_id: "1",
      invoice_number: "INV-001602",
      customer_name: "Jane",
      balance: 99.5,
      currency_code: "ZAR",
      due_date: "2026-07-01",
      status: "overdue",
      line_items: [{ name: "Service", quantity: 2, rate: 50, item_total: 99.5 }],
    });

    expect(fields.amountDueCents).toBe(9_950);
    expect(fields.paymentStatus).toBe("payable");
    expect(fields.lineItems[0]).toEqual({
      name: "Service",
      quantity: 2,
      rateCents: 5_000,
      totalCents: 9_950,
    });
  });
});
