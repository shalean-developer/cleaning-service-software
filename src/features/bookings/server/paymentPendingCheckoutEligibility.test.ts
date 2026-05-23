import { describe, expect, it } from "vitest";
import { assessPendingPaymentCheckoutEligibility } from "./paymentPendingCheckoutEligibility";
import type { BookingRow, PaymentRow } from "@/lib/database/types";

function booking(partial: Partial<BookingRow>): BookingRow {
  return {
    id: "booking-1",
    customer_id: "customer-1",
    status: "pending_payment",
    scheduled_start: new Date(Date.now() + 86_400_000).toISOString(),
    scheduled_end: new Date(Date.now() + 90_000_000).toISOString(),
    price_cents: 100_000,
    currency: "ZAR",
    cleaner_id: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    service_id: null,
    series_id: null,
    assignment_dispatch_at: null,
    synthetic_anchor: false,
    ...partial,
  } as BookingRow;
}

function payment(partial: Partial<PaymentRow>): PaymentRow {
  return {
    id: "payment-1",
    booking_id: "booking-1",
    status: "pending",
    amount_cents: 100_000,
    currency: "ZAR",
    provider: "paystack",
    provider_ref: null,
    idempotency_key: "paystack:booking:booking-1",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    payment_link_expires_at: null,
    ...partial,
  } as PaymentRow;
}

describe("assessPendingPaymentCheckoutEligibility", () => {
  it("allows checkout for pending_payment bookings with future schedule", () => {
    expect(
      assessPendingPaymentCheckoutEligibility(booking({}), [payment({})]),
    ).toBe(true);
  });

  it("rejects payment_failed bookings", () => {
    expect(
      assessPendingPaymentCheckoutEligibility(
        booking({ status: "payment_failed" }),
        [payment({ status: "failed" })],
      ),
    ).toBe(false);
  });

  it("rejects when a paid payment already exists", () => {
    expect(
      assessPendingPaymentCheckoutEligibility(booking({}), [payment({ status: "paid" })]),
    ).toBe(false);
  });

  it("rejects past schedule", () => {
    expect(
      assessPendingPaymentCheckoutEligibility(
        booking({ scheduled_start: new Date(Date.now() - 86_400_000).toISOString() }),
        [payment({})],
      ),
    ).toBe(false);
  });
});
