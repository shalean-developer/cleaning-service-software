import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filledState } from "./testFixtures";
import { buildLockRequestPayload } from "./lockPayload";

const fetchMock = vi.fn();

describe("wizard API integration order", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls lock before paystack initialize on checkout", async () => {
    const { createPaymentLock, initializePaystackCheckout } = await import("./api");

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          lockId: "lock-1",
          bookingId: "booking-1",
          lockedPriceCents: 59_000,
          currency: "ZAR",
          expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
          paymentIdempotencyKey: "paystack:checkout:test-key",
          idempotent: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          authorization_url: "https://paystack.test/pay",
          bookingId: "booking-1",
          status: "pending_payment",
        }),
      });

    const state = filledState({ quote: null });
    const quote = {
      totalCents: 59_000,
      currency: "ZAR" as const,
      lineItems: [],
      subtotalCents: 59_000,
      discountCents: 0,
      pricingVersion: "2026-05-16-mvp" as const,
      serviceSlug: "regular-cleaning" as const,
      frequency: "once" as const,
      cleanerEarnings: {
        perCleanerAmountCents: 30_000,
        teamSize: 1,
        totalCleanerPayoutCents: 30_000,
        ruleApplied: "x",
        metadata: {},
      },
      metadata: {},
    };

    const lockBody = buildLockRequestPayload(state, quote, "checkout:test-key");
    if ("error" in lockBody) throw new Error(lockBody.error);

    const lock = await createPaymentLock(lockBody);
    expect(lock.ok).toBe(true);

    const checkout = await initializePaystackCheckout({
      bookingId: "booking-1",
      lockId: "lock-1",
      paymentIdempotencyKey: "paystack:checkout:test-key",
      email: "u@test.com",
    });

    expect(checkout.ok).toBe(true);
    if (checkout.ok) {
      expect(checkout.status).toBe("pending_payment");
    }

    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls[0]).toBe("/api/bookings/lock");
    expect(urls[1]).toBe("/api/paystack/initialize");
  });
});
