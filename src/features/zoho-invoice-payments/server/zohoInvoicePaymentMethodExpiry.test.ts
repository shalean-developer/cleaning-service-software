import { describe, expect, it } from "vitest";
import { isPaymentMethodExpired } from "./zohoInvoicePaymentMethodExpiry";

describe("isPaymentMethodExpired", () => {
  it("returns false when expiry is missing", () => {
    expect(isPaymentMethodExpired(null, null)).toBe(false);
  });

  it("returns false for future expiry", () => {
    expect(isPaymentMethodExpired("12", "2030", new Date("2026-01-01"))).toBe(false);
  });

  it("returns true for past expiry", () => {
    expect(isPaymentMethodExpired("01", "2020", new Date("2026-01-01"))).toBe(true);
  });
});
