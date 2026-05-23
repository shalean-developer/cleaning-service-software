import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const requireApiUserMock = vi.fn();
const loadDiagnosticsMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (value: unknown) =>
    typeof value === "object" && value != null && "ok" in value && (value as { ok: boolean }).ok === false,
}));

vi.mock("@/features/zoho-invoice-payments/server/loadZohoInvoicePaymentDiagnostics", () => ({
  loadZohoInvoicePaymentDiagnostics: (...args: unknown[]) => loadDiagnosticsMock(...args),
}));

describe("GET /api/admin/zoho-invoice-payments/diagnostics", () => {
  it("requires admin access", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Insufficient role.",
    });

    const response = await GET(new Request("http://localhost/api/admin/zoho-invoice-payments/diagnostics"));
    expect(response.status).toBe(403);
  });

  it("returns safe diagnostics payload", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    loadDiagnosticsMock.mockResolvedValue({
      summary: {
        pending_paystack: 1,
        paid: 2,
        failed: 0,
        zoho_reconcile_pending: 1,
        zoho_reconcile_failed: 0,
      },
      payments: [
        {
          invoiceNumber: "INV-001602",
          amountCents: 10_000,
          amountDisplay: "R100.00",
          currency: "ZAR",
          status: "zoho_reconcile_pending",
          reconcileAttempts: 1,
          lastReconcileAttemptAt: "2026-01-01T00:00:00.000Z",
          nextReconcileAttemptAt: "2026-01-01T00:05:00.000Z",
          safeLastError: "ZOHO_HTTP_ERROR",
          maskedCustomerEmail: "j***@example.com",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          paidAt: null,
        },
      ],
    });

    const response = await GET(
      new Request("http://localhost/api/admin/zoho-invoice-payments/diagnostics?status=zoho_reconcile_pending"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary.zoho_reconcile_pending).toBe(1);
    expect(body.payments[0].maskedCustomerEmail).toBe("j***@example.com");
    expect(body.payments[0]).not.toHaveProperty("metadata");
    expect(body.payments[0]).not.toHaveProperty("paystack_access_code");
    expect(body.payments[0]).not.toHaveProperty("authorization_url");
    expect(loadDiagnosticsMock).toHaveBeenCalledWith({
      status: "zoho_reconcile_pending",
      invoiceNumber: undefined,
      limit: undefined,
    });
  });
});
