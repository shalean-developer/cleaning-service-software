import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const requireApiUserMock = vi.fn();
const revokeAdminMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (value: unknown) =>
    typeof value === "object" && value != null && "ok" in value && (value as { ok: boolean }).ok === false,
}));

vi.mock("@/features/zoho-invoice-payments/server/revokeAdminPaymentMethod", () => ({
  revokeAdminPaymentMethod: (...args: unknown[]) => revokeAdminMock(...args),
}));

describe("POST admin payment-methods revoke", () => {
  it("rejects non-admin", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          reason: "Customer requested removal via support",
          confirmPhrase: "REVOKE PAYMENT METHOD",
        }),
      }),
      { params: Promise.resolve({ paymentMethodId: "method-1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("rejects wrong confirm phrase", async () => {
    requireApiUserMock.mockResolvedValue({
      role: "admin",
      profileId: "admin-1",
    });
    revokeAdminMock.mockResolvedValue({
      ok: false,
      code: "INVALID_CONFIRM_PHRASE",
      message: "Confirmation phrase must match exactly.",
      status: 400,
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          reason: "Customer requested removal via support",
          confirmPhrase: "REVOKE NOW",
        }),
      }),
      { params: Promise.resolve({ paymentMethodId: "method-1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("revokes with valid reason and phrase", async () => {
    requireApiUserMock.mockResolvedValue({
      role: "admin",
      profileId: "admin-1",
    });
    revokeAdminMock.mockResolvedValue({
      ok: true,
      paymentMethodId: "method-1",
      idempotent: false,
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          reason: "Customer requested removal via support ticket",
          confirmPhrase: "REVOKE PAYMENT METHOD",
        }),
      }),
      { params: Promise.resolve({ paymentMethodId: "method-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body).not.toHaveProperty("authorization_code");
  });
});
