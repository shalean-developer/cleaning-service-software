import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/customer/payment-methods/route";
import { POST } from "@/app/api/customer/payment-methods/[paymentMethodId]/revoke/route";

const requireApiUserMock = vi.fn();
const loadCustomerMock = vi.fn();
const revokeCustomerMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (value: unknown) =>
    typeof value === "object" && value != null && "ok" in value && (value as { ok: boolean }).ok === false,
}));

vi.mock("@/features/zoho-invoice-payments/server/loadCustomerPaymentMethods", () => ({
  loadCustomerPaymentMethods: (...args: unknown[]) => loadCustomerMock(...args),
}));

vi.mock("@/features/zoho-invoice-payments/server/revokeCustomerPaymentMethod", () => ({
  revokeCustomerPaymentMethod: (...args: unknown[]) => revokeCustomerMock(...args),
}));

describe("customer payment-methods API", () => {
  it("GET rejects unauthenticated requests", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: "UNAUTHORIZED",
    });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("GET returns safe methods for customer", async () => {
    requireApiUserMock.mockResolvedValue({
      role: "customer",
      profileId: "profile-1",
      authUser: { email: "jane@example.com" },
    });
    loadCustomerMock.mockResolvedValue({
      methods: [
        {
          id: "method-1",
          cardType: "visa",
          last4: "1234",
          bank: null,
          expMonth: "12",
          expYear: "2030",
          reusable: true,
          isDefault: true,
          consentedAt: "2026-01-01T00:00:00.000Z",
          revokedAt: null,
          sourceInvoiceNumber: "INV-001",
          lastUsedAt: null,
          lastUsedInvoiceNumber: null,
        },
      ],
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.methods[0].last4).toBe("1234");
    expect(body.methods[0]).not.toHaveProperty("authorization_code");
  });

  it("POST revoke rejects another customer method", async () => {
    requireApiUserMock.mockResolvedValue({
      role: "customer",
      profileId: "profile-1",
      authUser: { email: "jane@example.com" },
    });
    revokeCustomerMock.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
      message: "You cannot revoke this payment method.",
      status: 403,
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ reason: "No longer needed" }),
      }),
      { params: Promise.resolve({ paymentMethodId: "method-other" }) },
    );

    expect(response.status).toBe(403);
  });

  it("POST revoke succeeds for own method", async () => {
    requireApiUserMock.mockResolvedValue({
      role: "customer",
      profileId: "profile-1",
      authUser: { email: "jane@example.com" },
    });
    revokeCustomerMock.mockResolvedValue({
      ok: true,
      paymentMethodId: "method-1",
      idempotent: false,
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ reason: "No longer needed" }),
      }),
      { params: Promise.resolve({ paymentMethodId: "method-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.paymentMethodId).toBe("method-1");
  });
});
