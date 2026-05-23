import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/customer/payment-history/route";

const requireApiUserMock = vi.fn();
const loadHistoryMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (value: unknown) =>
    typeof value === "object" && value != null && "ok" in value && (value as { ok: boolean }).ok === false,
}));

vi.mock("@/features/customer-payments/server/customerPaymentHistory", () => ({
  loadCustomerPaymentHistoryForUser: (...args: unknown[]) => loadHistoryMock(...args),
}));

describe("GET /api/customer/payment-history", () => {
  it("rejects unauthenticated requests", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: "UNAUTHORIZED",
    });

    const response = await GET(new Request("http://localhost/api/customer/payment-history"));
    expect(response.status).toBe(401);
  });

  it("filters by source and status", async () => {
    requireApiUserMock.mockResolvedValue({
      role: "customer",
      profileId: "profile-1",
      authUser: { email: "jane@example.com" },
    });
    loadHistoryMock.mockResolvedValue({ items: [], nextCursor: null });

    const response = await GET(
      new Request(
        "http://localhost/api/customer/payment-history?source=booking&status=paid&limit=10",
      ),
    );

    expect(response.status).toBe(200);
    expect(loadHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authUser: { email: "jane@example.com" },
      }),
      expect.objectContaining({
        source: "booking",
        status: "paid",
        limit: 10,
      }),
    );
  });

  it("enforces max limit", async () => {
    requireApiUserMock.mockResolvedValue({
      role: "customer",
      profileId: "profile-1",
      authUser: { email: "jane@example.com" },
    });

    const response = await GET(
      new Request("http://localhost/api/customer/payment-history?limit=100"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("INVALID_LIMIT");
  });

  it("returns safe DTO without secrets", async () => {
    requireApiUserMock.mockResolvedValue({
      role: "customer",
      profileId: "profile-1",
      authUser: { email: "jane@example.com" },
    });
    loadHistoryMock.mockResolvedValue({
      items: [
        {
          id: "zoho_invoice:pay-1",
          source: "zoho_invoice",
          title: "Invoice INV-001",
          reference: "ref-1",
          invoiceNumber: "INV-001",
          bookingId: null,
          amountCents: 5000,
          currency: "ZAR",
          status: "paid",
          paidAt: "2026-05-01T00:00:00.000Z",
          createdAt: "2026-05-01T00:00:00.000Z",
          paymentMethodLabel: "Paystack checkout",
          actionUrl: "/pay/INV-001",
        },
      ],
      nextCursor: null,
    });

    const response = await GET(new Request("http://localhost/api/customer/payment-history"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items[0].invoiceNumber).toBe("INV-001");
    expect(body.items[0]).not.toHaveProperty("authorization_code");
    expect(body.items[0]).not.toHaveProperty("access_code");
    expect(body.items[0]).not.toHaveProperty("metadata");
    expect(body.items[0]).not.toHaveProperty("adminReason");
  });
});
