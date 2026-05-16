import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const retryLockMock = vi.fn();
const getCurrentUserMock = vi.fn();

vi.mock("@/features/bookings/server/lock/createPaymentRetryLock", () => ({
  createPaymentRetryLock: (...args: unknown[]) => retryLockMock(...args),
}));

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

const customerUser: CurrentUser = {
  profileId: "profile-1",
  role: "customer",
  authUser: { id: "profile-1", email: "c@test.com" } as CurrentUser["authUser"],
};

describe("POST /api/bookings/[bookingId]/payment-retry-lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue(customerUser);
    retryLockMock.mockResolvedValue({
      ok: true,
      lockId: "lock-1",
      bookingId: "booking-1",
      lockedPriceCents: 53_000,
      currency: "ZAR",
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      paymentIdempotencyKey: "paystack:checkout:retry:booking-1:1",
      idempotent: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null);
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/bookings/booking-1/payment-retry-lock", {
        method: "POST",
        body: JSON.stringify({ checkoutIdempotencyKey: "retry:booking-1:1" }),
      }),
      { params: Promise.resolve({ bookingId: "booking-1" }) },
    );
    expect(response.status).toBe(401);
    expect(retryLockMock).not.toHaveBeenCalled();
  });

  it("delegates to createPaymentRetryLock with booking id and key", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/bookings/booking-1/payment-retry-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutIdempotencyKey: "retry:booking-1:1" }),
      }),
      { params: Promise.resolve({ bookingId: "booking-1" }) },
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.lockId).toBe("lock-1");
    expect(retryLockMock).toHaveBeenCalledWith(customerUser, "booking-1", {
      checkoutIdempotencyKey: "retry:booking-1:1",
    });
  });
});
