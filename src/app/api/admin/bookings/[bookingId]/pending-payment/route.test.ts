import { beforeEach, describe, expect, it, vi } from "vitest";

const adminCreatePendingPaymentBookingFacadeMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/features/bookings/server/admin/adminCreatePendingPaymentBookingFacade", () => ({
  adminCreatePendingPaymentBookingFacade: (...args: unknown[]) =>
    adminCreatePendingPaymentBookingFacadeMock(...args),
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

describe("POST /api/admin/bookings/[bookingId]/pending-payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
    adminCreatePendingPaymentBookingFacadeMock.mockResolvedValue({
      ok: true,
      booking: {
        bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "pending_payment",
        paymentStatus: "pending",
        priceCents: 50000,
        currency: "ZAR",
        idempotent: false,
      },
    });
  });

  it("returns ok for valid admin request", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/bookings/b/pending-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: "11111111-1111-4111-8111-111111111111",
          idempotencyKey: "pending-key-12345678",
        }),
      }),
      { params: Promise.resolve({ bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.booking.status).toBe("pending_payment");
    expect(adminCreatePendingPaymentBookingFacadeMock).toHaveBeenCalledOnce();
  });

  it("rejects non-admin", async () => {
    requireApiUserMock.mockResolvedValue({
      error: "FORBIDDEN",
      message: "Admins only.",
      status: 403,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/bookings/b/pending-payment", {
        method: "POST",
        body: JSON.stringify({
          customerId: "11111111-1111-4111-8111-111111111111",
          idempotencyKey: "pending-key-12345678",
        }),
      }),
      { params: Promise.resolve({ bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) },
    );

    expect(response.status).toBe(403);
    expect(adminCreatePendingPaymentBookingFacadeMock).not.toHaveBeenCalled();
  });

  it("validates body", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/bookings/b/pending-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: "not-a-uuid" }),
      }),
      { params: Promise.resolve({ bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) },
    );

    expect(response.status).toBe(400);
    expect(adminCreatePendingPaymentBookingFacadeMock).not.toHaveBeenCalled();
  });

  it("does not export GET", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src/app/api/admin/bookings/[bookingId]/pending-payment/route.ts"), "utf8");
    expect(source).not.toContain("export async function GET");
  });
});
