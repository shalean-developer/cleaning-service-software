import { describe, expect, it } from "vitest";
import {
  paymentSuccessLead,
  paymentSuccessTitle,
  PAYMENT_VERIFY_LOADING_COPY,
  resolvePaymentSuccessVariant,
} from "./paymentReturnDisplay";

describe("paymentReturnDisplay", () => {
  it("uses calm confirming copy for loading state", () => {
    expect(PAYMENT_VERIFY_LOADING_COPY.title).toBe("Confirming your payment");
    expect(PAYMENT_VERIFY_LOADING_COPY.body).toContain("Paystack");
  });

  it("uses lifecycle-safe success titles", () => {
    expect(paymentSuccessTitle("confirmed")).toBe("Booking confirmed");
    expect(paymentSuccessTitle("already_confirmed")).toBe("Payment already confirmed");
    expect(resolvePaymentSuccessVariant(true)).toBe("already_confirmed");
    expect(paymentSuccessLead("confirmed")).toContain("successful");
  });
});
