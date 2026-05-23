import { beforeEach, describe, expect, it, vi } from "vitest";

const adminRecordOfflinePaymentFacadeMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/features/bookings/server/admin/adminRecordOfflinePaymentFacade", () => ({
  adminRecordOfflinePaymentFacade: (...args: unknown[]) =>
    adminRecordOfflinePaymentFacadeMock(...args),
}));

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" &&
    user !== null &&
    "ok" in user &&
    (user as { ok: boolean }).ok === false,
}));

import { POST } from "./route";

const adminUser = {
  profileId: "admin-profile-1",
  role: "admin" as const,
  authUser: { id: "auth-admin" },
};

describe("POST /api/admin/bookings/[bookingId]/offline-payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
    adminRecordOfflinePaymentFacadeMock.mockResolvedValue({
      ok: true,
      payment: {
        bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "confirmed",
        paymentStatus: "paid",
        rail: "eft",
        reference: "admin:offline:eft:offline-key-12345678",
      },
    });
  });

  it("returns ok for valid admin request", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/bookings/b/offline-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: "11111111-1111-4111-8111-111111111111",
          amountCents: 45000,
          rail: "eft",
          receivedAt: "2026-01-01T10:00:00.000Z",
          evidenceReference: "EV-1",
          bankReference: "BNK-1",
          reason: "EFT received",
          idempotencyKey: "offline-key-12345678",
          sopConfirmed: true,
        }),
      }),
      { params: Promise.resolve({ bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.payment.status).toBe("confirmed");
    expect(adminRecordOfflinePaymentFacadeMock).toHaveBeenCalledOnce();
  });

  it("rejects non-admin", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      error: "FORBIDDEN",
      message: "Admins only.",
      status: 403,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/bookings/b/offline-payment", {
        method: "POST",
        body: JSON.stringify({
          customerId: "11111111-1111-4111-8111-111111111111",
          amountCents: 45000,
          rail: "eft",
          receivedAt: "2026-01-01T10:00:00.000Z",
          evidenceReference: "EV-1",
          bankReference: "BNK-1",
          reason: "EFT",
          idempotencyKey: "offline-key-12345678",
        }),
      }),
      { params: Promise.resolve({ bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) },
    );

    expect(response.status).toBe(403);
    expect(adminRecordOfflinePaymentFacadeMock).not.toHaveBeenCalled();
  });

  it("validates body", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/bookings/b/offline-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: "not-a-uuid" }),
      }),
      { params: Promise.resolve({ bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) },
    );

    expect(response.status).toBe(400);
    expect(adminRecordOfflinePaymentFacadeMock).not.toHaveBeenCalled();
  });

  it("does not export GET", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src/app/api/admin/bookings/[bookingId]/offline-payment/route.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/\bexport\s+async\s+function\s+GET\b/);
  });
});
