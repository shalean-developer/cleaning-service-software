import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mapRetryPaymentError,
  startPaymentRetryCheckout,
} from "./retryPaymentFlow";

describe("mapRetryPaymentError", () => {
  it("maps known API codes to safe copy", () => {
    expect(mapRetryPaymentError("QUOTE_STALE")).toContain("start a new booking");
    expect(mapRetryPaymentError("ACTIVE_LOCK_EXISTS")).toContain("already open");
    expect(mapRetryPaymentError("RETRY_NOT_ELIGIBLE")).toContain("no longer be retried");
    expect(mapRetryPaymentError("INVALID_SCHEDULE")).toContain("time has passed");
    expect(mapRetryPaymentError("CLEANER_INELIGIBLE")).toContain("cleaner is no longer available");
  });

  it("uses fallback for unknown codes", () => {
    expect(mapRetryPaymentError("INTERNAL_ERROR", "Server busy")).toBe("Server busy");
    expect(mapRetryPaymentError(undefined)).toContain("Could not start checkout");
  });
});

describe("startPaymentRetryCheckout", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls retry-lock then initialize and returns authorization URL", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          lockId: "lock-1",
          paymentIdempotencyKey: "paystack:checkout:retry:booking-1:abc",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          authorization_url: "https://checkout.paystack.com/retry",
        }),
      });

    const result = await startPaymentRetryCheckout("booking-1", "customer@test.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.authorizationUrl).toBe("https://checkout.paystack.com/retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const lockCall = fetchMock.mock.calls[0]!;
    expect(String(lockCall[0])).toContain("/api/bookings/booking-1/payment-retry-lock");
    expect(lockCall[1]?.method).toBe("POST");

    const initCall = fetchMock.mock.calls[1]!;
    expect(String(initCall[0])).toBe("/api/paystack/initialize");
    const initBody = JSON.parse(String(initCall[1]?.body)) as {
      bookingId: string;
      lockId: string;
      paymentIdempotencyKey: string;
      email: string;
    };
    expect(initBody.bookingId).toBe("booking-1");
    expect(initBody.lockId).toBe("lock-1");
    expect(initBody.paymentIdempotencyKey).toBe("paystack:checkout:retry:booking-1:abc");
    expect(initBody.email).toBe("customer@test.com");
  });

  it("surfaces retry-lock errors without calling initialize", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        ok: false,
        error: "QUOTE_STALE",
        message: "stale",
      }),
    });

    const result = await startPaymentRetryCheckout("booking-1", "customer@test.com");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("price has changed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
