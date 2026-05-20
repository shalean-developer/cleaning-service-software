import { describe, expect, it } from "vitest";
import {
  buildPaymentSuccessCallbackUrl,
  customerBookingDetailPath,
  parseVerifyPaymentResponse,
  resolvePaystackReference,
} from "./paymentReturn";

describe("buildPaymentSuccessCallbackUrl", () => {
  it("appends /payment/success without duplicate slashes", () => {
    expect(buildPaymentSuccessCallbackUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/payment/success",
    );
    expect(buildPaymentSuccessCallbackUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/payment/success",
    );
  });

  it("appends service slug for Airbnb turnover callback copy", () => {
    expect(
      buildPaymentSuccessCallbackUrl("http://localhost:3000", "airbnb-cleaning"),
    ).toBe("http://localhost:3000/payment/success?service=airbnb-cleaning");
  });
});

describe("resolvePaystackReference", () => {
  it("prefers reference over trxref", () => {
    const params = new URLSearchParams("reference=ref_a&trxref=ref_b");
    expect(resolvePaystackReference(params)).toBe("ref_a");
  });

  it("falls back to trxref", () => {
    const params = new URLSearchParams("trxref=ref_b");
    expect(resolvePaystackReference(params)).toBe("ref_b");
  });

  it("returns null when missing", () => {
    expect(resolvePaystackReference(new URLSearchParams())).toBeNull();
  });
});

describe("parseVerifyPaymentResponse", () => {
  it("parses successful paid verify", () => {
    const result = parseVerifyPaymentResponse({
      ok: true,
      paid: true,
      bookingId: "b-1",
      reference: "ref-1",
      idempotent: false,
      status: "confirmed",
    });
    expect(result).toEqual({
      ok: true,
      paid: true,
      bookingId: "b-1",
      reference: "ref-1",
      idempotent: false,
      status: "confirmed",
    });
  });

  it("parses idempotent success", () => {
    const result = parseVerifyPaymentResponse({
      ok: true,
      paid: true,
      bookingId: "b-1",
      reference: "ref-1",
      idempotent: true,
      status: "confirmed",
    });
    expect(result.ok && result.paid && result.idempotent).toBe(true);
  });

  it("parses unpaid verify without mutating booking", () => {
    const result = parseVerifyPaymentResponse({
      ok: true,
      paid: false,
      reference: "ref-1",
      status: "pending",
    });
    expect(result).toEqual({
      ok: true,
      paid: false,
      reference: "ref-1",
      status: "pending",
      message: undefined,
    });
  });

  it("parses API error", () => {
    const result = parseVerifyPaymentResponse({
      ok: false,
      error: "FORBIDDEN",
      message: "Cannot verify another customer's payment.",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("FORBIDDEN");
  });
});

describe("customerBookingDetailPath", () => {
  it("builds customer booking detail URL", () => {
    expect(customerBookingDetailPath("abc-123")).toBe("/customer/bookings/abc-123");
  });
});
