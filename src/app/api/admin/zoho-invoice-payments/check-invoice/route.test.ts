import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const requireApiUserMock = vi.fn();
const checkInvoiceMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (value: unknown) =>
    typeof value === "object" && value != null && "ok" in value && (value as { ok: boolean }).ok === false,
}));

vi.mock("@/features/zoho-invoice-payments/server/checkZohoInvoiceForAdmin", () => ({
  checkZohoInvoiceForAdmin: (...args: unknown[]) => checkInvoiceMock(...args),
}));

describe("GET /api/admin/zoho-invoice-payments/check-invoice", () => {
  it("requires admin access", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Insufficient role.",
    });

    const response = await GET(
      new Request("http://localhost/api/admin/zoho-invoice-payments/check-invoice?invoiceNumber=INV-001"),
    );

    expect(response.status).toBe(403);
  });

  it("returns safe admin invoice summary without raw Zoho fields", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    checkInvoiceMock.mockResolvedValue({
      ok: true,
      invoiceNumber: "INV-001602",
      customerName: "Jane Doe",
      amountDueCents: 10_000,
      amountDueDisplay: "R100.00",
      currency: "ZAR",
      dueDate: "2026-06-01",
      status: "payable",
      canPayNow: true,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/zoho-invoice-payments/check-invoice?invoiceNumber=INV-001602",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.invoiceNumber).toBe("INV-001602");
    expect(body.customerName).toBe("Jane Doe");
    expect(body.canPayNow).toBe(true);
    expect(body).not.toHaveProperty("rawZohoPayload");
    expect(body).not.toHaveProperty("customerEmail");
    expect(body).not.toHaveProperty("email");
  });

  it("maps not configured to 503", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    checkInvoiceMock.mockResolvedValue({
      ok: false,
      code: "NOT_CONFIGURED",
      message: "Online invoice payments are not available yet.",
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/zoho-invoice-payments/check-invoice?invoiceNumber=INV-001602",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("NOT_CONFIGURED");
  });

  it("rejects invalid invoice number", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    checkInvoiceMock.mockResolvedValue({
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
      message: "Invalid invoice number.",
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/zoho-invoice-payments/check-invoice?invoiceNumber=../bad",
      ),
    );

    expect(response.status).toBe(400);
  });
});
