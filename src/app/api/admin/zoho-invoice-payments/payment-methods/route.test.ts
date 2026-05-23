import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const requireApiUserMock = vi.fn();
const loadMethodsMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (value: unknown) =>
    typeof value === "object" && value != null && "ok" in value && (value as { ok: boolean }).ok === false,
}));

vi.mock("@/features/zoho-invoice-payments/server/loadZohoInvoicePaymentMethodAdminSummary", () => ({
  loadAdminZohoPaymentMethodsByEmail: (...args: unknown[]) => loadMethodsMock(...args),
}));

describe("GET /api/admin/zoho-invoice-payments/payment-methods", () => {
  it("requires admin access", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Insufficient role.",
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/zoho-invoice-payments/payment-methods?customerEmail=jane@example.com",
      ),
    );

    expect(response.status).toBe(403);
  });

  it("returns safe DTO without authorization_code", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    loadMethodsMock.mockResolvedValue([
      {
        id: "method-1",
        card_type: "visa",
        bank: "GTBank",
        last4: "1234",
        exp_month: "12",
        exp_year: "2030",
        reusable: true,
        is_default: true,
        consented_at: "2026-01-01T00:00:00.000Z",
        revoked_at: null,
        source_invoice_number: "INV-001602",
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/zoho-invoice-payments/payment-methods?customerEmail=jane@example.com",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.methods[0].last4).toBe("1234");
    expect(body.methods[0]).not.toHaveProperty("authorization_code");
    expect(body.methods[0]).not.toHaveProperty("customer_email");
  });
});
