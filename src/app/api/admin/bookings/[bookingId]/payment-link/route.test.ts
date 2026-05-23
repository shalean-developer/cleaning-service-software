import { beforeEach, describe, expect, it, vi } from "vitest";

const adminGeneratePaymentLinkFacadeMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/features/bookings/server/admin/adminGeneratePaymentLinkFacade", () => ({
  adminGeneratePaymentLinkFacade: (...args: unknown[]) =>
    adminGeneratePaymentLinkFacadeMock(...args),
}));

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    Boolean(user && typeof user === "object" && "error" in user),
}));

import { POST } from "./route";

const adminUser = {
  profileId: "admin-profile-1",
  role: "admin" as const,
  authUser: { id: "auth-admin" },
};

describe("POST /api/admin/bookings/[bookingId]/payment-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
    adminGeneratePaymentLinkFacadeMock.mockResolvedValue({
      ok: true,
      paymentLink: {
        bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        paymentUrl: "https://checkout.paystack.com/test",
        reference: "bk_test_ref",
        expiresAt: "2099-01-01T00:00:00.000Z",
        idempotent: false,
      },
    });
  });

  it("returns paymentUrl for valid admin request", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/bookings/b/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: "11111111-1111-4111-8111-111111111111",
          idempotencyKey: "plink-key-12345678",
          deliveryChannel: "copy_only",
        }),
      }),
      { params: Promise.resolve({ bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.paymentLink.paymentUrl).toContain("paystack");
    expect(adminGeneratePaymentLinkFacadeMock).toHaveBeenCalledOnce();
  });

  it("rejects non-admin", async () => {
    requireApiUserMock.mockResolvedValue({
      error: "FORBIDDEN",
      message: "Admins only.",
      status: 403,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/bookings/b/payment-link", {
        method: "POST",
        body: JSON.stringify({
          customerId: "11111111-1111-4111-8111-111111111111",
          idempotencyKey: "plink-key-12345678",
        }),
      }),
      { params: Promise.resolve({ bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) },
    );

    expect(response.status).toBe(403);
    expect(adminGeneratePaymentLinkFacadeMock).not.toHaveBeenCalled();
  });

  it("validates body", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/bookings/b/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: "not-a-uuid" }),
      }),
      { params: Promise.resolve({ bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) },
    );

    expect(response.status).toBe(400);
    expect(adminGeneratePaymentLinkFacadeMock).not.toHaveBeenCalled();
  });

  it("does not export GET", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src/app/api/admin/bookings/[bookingId]/payment-link/route.ts"), "utf8");
    expect(source).not.toMatch(/\bexport\s+async\s+function\s+GET\b/);
  });

  it("does not add full POST /api/admin/bookings create endpoint", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src/app/api/admin/bookings/route.ts"), "utf8");
    expect(source).not.toMatch(/\bexport\s+async\s+function\s+POST\b/);
    expect(source).not.toMatch(/\bADMIN_CREATE_BOOKING\b/);
  });
});
