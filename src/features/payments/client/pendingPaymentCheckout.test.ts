import { afterEach, describe, expect, it, vi } from "vitest";
import { startPendingPaymentCheckout } from "./pendingPaymentCheckout";

describe("startPendingPaymentCheckout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens Paystack checkout via initialize without retry lock", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        authorization_url: "https://checkout.paystack.com/test",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await startPendingPaymentCheckout("booking-1", "customer@test.com");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.authorizationUrl).toBe("https://checkout.paystack.com/test");
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/paystack/initialize");
    expect(JSON.parse(String(init.body))).toEqual({
      bookingId: "booking-1",
      email: "customer@test.com",
      paymentIdempotencyKey: "paystack:booking:booking-1",
    });
  });
});
