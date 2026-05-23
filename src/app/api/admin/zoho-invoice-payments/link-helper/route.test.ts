import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const requireApiUserMock = vi.fn();
const generateLinkMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (value: unknown) =>
    typeof value === "object" && value != null && "ok" in value && (value as { ok: boolean }).ok === false,
}));

vi.mock("@/features/zoho-invoice-payments/server/generateZohoInvoiceAdminPaymentLink", () => ({
  generateZohoInvoiceAdminPaymentLink: (...args: unknown[]) => generateLinkMock(...args),
}));

describe("GET /api/admin/zoho-invoice-payments/link-helper", () => {
  it("requires admin access", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Insufficient role.",
    });

    const response = await GET(
      new Request("http://localhost/api/admin/zoho-invoice-payments/link-helper?invoiceNumber=INV-001"),
    );

    expect(response.status).toBe(403);
  });

  it("rejects missing invoice number", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });

    const response = await GET(
      new Request("http://localhost/api/admin/zoho-invoice-payments/link-helper"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("INVALID_INVOICE_NUMBER");
  });

  it("returns payment link for valid invoice number", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    generateLinkMock.mockResolvedValue({
      ok: true,
      invoiceNumber: "inv-001602",
      normalizedInvoiceNumber: "INV-001602",
      paymentLink: "https://www.shalean.com/pay/INV-001602",
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/zoho-invoice-payments/link-helper?invoiceNumber=inv-001602",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      invoiceNumber: "inv-001602",
      normalizedInvoiceNumber: "INV-001602",
      paymentLink: "https://www.shalean.com/pay/INV-001602",
    });
    expect(generateLinkMock).toHaveBeenCalledWith("inv-001602");
  });

  it("returns safe validation error for invalid invoice number", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    generateLinkMock.mockResolvedValue({
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
      message: "Invalid invoice number.",
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/zoho-invoice-payments/link-helper?invoiceNumber=../bad",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_INVOICE_NUMBER");
  });
});
