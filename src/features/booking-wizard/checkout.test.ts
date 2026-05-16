import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { buildInitializeCheckoutPayload, isPaystackRedirectResponse } from "./checkout";
import { filledState } from "./testFixtures";
import { canProceedToCheckout } from "./validation";

describe("checkout payload", () => {
  it("requires pricing quote before checkout", () => {
    expect(canProceedToCheckout(filledState({ quote: null, reviewConfirmed: true }))).toBe(
      false,
    );
  });

  it("builds initialize payload with callbackUrl for Paystack return", () => {
    const state = filledState();
    const quoteResult = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: state.bedrooms,
      bathrooms: state.bathrooms,
    });
    expect(quoteResult.ok).toBe(true);
    if (!quoteResult.ok) return;

    const payload = buildInitializeCheckoutPayload(
      {
        bookingId: "booking-1",
        lockId: "lock-1",
        paymentIdempotencyKey: "paystack:checkout:key-1",
        email: "customer@shalean.co.za",
      },
      { ...state, quote: quoteResult.breakdown, reviewConfirmed: true },
      quoteResult.breakdown,
    );

    expect("error" in payload).toBe(false);
    if ("error" in payload) return;

    expect(payload.bookingId).toBe("booking-1");
    expect(payload.lockId).toBe("lock-1");
    expect(payload.paymentIdempotencyKey).toBe("paystack:checkout:key-1");
    expect(payload.callbackUrl).toMatch(/\/payment\/success$/);
    expect(payload).not.toHaveProperty("priceCents");
  });

  it("rejects checkout when selected cleaner is ineligible", () => {
    const state = filledState({
      cleanerPreferenceMode: "selected",
      selectedCleanerId: "bad-cleaner",
      availableCleaners: [
        {
          cleanerId: "bad-cleaner",
          displayName: "Bad",
          rating: null,
          serviceAreasSummary: "",
          availabilitySummary: "",
          eligibilityStatus: "ineligible",
          eligibilityReason: "Suspended",
          eligibilityCode: "suspended",
        },
      ],
    });
    const quoteResult = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    });
    if (!quoteResult.ok) throw new Error("quote failed");

    const payload = buildInitializeCheckoutPayload(
      {
        bookingId: "b1",
        lockId: "l1",
        paymentIdempotencyKey: "paystack:checkout:k",
        email: "a@b.co",
      },
      { ...state, quote: quoteResult.breakdown, reviewConfirmed: true },
      quoteResult.breakdown,
    );
    expect(payload).toEqual({
      error: "Selected cleaner is not eligible for checkout.",
    });
  });

  it("recognizes paystack redirect response shape (pending_payment only)", () => {
    expect(
      isPaystackRedirectResponse({
        ok: true,
        authorization_url: "https://paystack.com/pay/abc",
        status: "pending_payment",
      }),
    ).toBe(true);
    expect(
      isPaystackRedirectResponse({
        ok: true,
        authorization_url: "https://paystack.com/pay/abc",
        status: "confirmed",
      }),
    ).toBe(false);
  });
});
