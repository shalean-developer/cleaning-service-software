import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const fetchStatusMock = vi.fn();

vi.mock("@/features/zoho-invoice-payments/server/fetchZohoInvoicePaymentStatusByReference", () => ({
  fetchZohoInvoicePaymentStatusByReference: (...args: unknown[]) => fetchStatusMock(...args),
}));

describe("GET /api/payments/zoho-invoice/status/[reference]", () => {
  it("returns safe status payload", async () => {
    fetchStatusMock.mockResolvedValue({
      ok: true,
      invoiceNumber: "INV-001602",
      reference: "zi_INV_001602_ab12cd34",
      status: "paid",
      message: "Payment successful. Your invoice has been marked paid.",
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ reference: "zi_INV_001602_ab12cd34" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      invoiceNumber: "INV-001602",
      reference: "zi_INV_001602_ab12cd34",
      status: "paid",
      message: "Payment successful. Your invoice has been marked paid.",
    });
    expect(body).not.toHaveProperty("metadata");
  });

  it("returns 400 for invalid reference", async () => {
    fetchStatusMock.mockResolvedValue({
      ok: false,
      code: "INVALID_REFERENCE",
      message: "Invalid payment reference.",
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ reference: "bad ref" }),
    });
    expect(response.status).toBe(400);
  });
});
