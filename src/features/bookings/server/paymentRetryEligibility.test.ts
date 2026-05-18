import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { buildBookingQuoteMetadata } from "@/features/pricing/server/metadata";
import type { BookingRow, PaymentRow } from "@/lib/database/types";
import { assessPaymentRetryEligibility, bookingHasPaidPayment } from "./paymentRetryEligibility";

const pricingInput = {
  serviceSlug: "regular-cleaning" as const,
  bedrooms: 2,
  bathrooms: 1,
};

function paymentFailedBooking(priceCents: number): BookingRow {
  const quote = calculateQuote(pricingInput);
  if (!quote.ok) throw new Error("quote");
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const end = new Date(future.getTime() + 2 * 60 * 60 * 1000);
  return {
    id: "booking-1",
    customer_id: "customer-1",
    cleaner_id: null,
    service_id: null,
    status: "payment_failed",
    scheduled_start: future.toISOString(),
    scheduled_end: end.toISOString(),
    assignment_dispatch_at: null,
    price_cents: priceCents,
    currency: "ZAR",
    series_id: null,
    metadata: { ...buildBookingQuoteMetadata(pricingInput, quote.breakdown), suburb: "Sea Point" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("assessPaymentRetryEligibility", () => {
  const prevLock = process.env.BOOKING_LOCK_REQUIRED;

  beforeEach(() => {
    process.env.BOOKING_LOCK_REQUIRED = "true";
  });

  afterEach(() => {
    if (prevLock === undefined) delete process.env.BOOKING_LOCK_REQUIRED;
    else process.env.BOOKING_LOCK_REQUIRED = prevLock;
  });

  it("allows eligible payment_failed booking when lock required", () => {
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const booking = paymentFailedBooking(quote.breakdown.totalCents);
    expect(assessPaymentRetryEligibility(booking, [])).toBe(true);
  });

  it("rejects confirmed booking", () => {
    const booking = paymentFailedBooking(53_000);
    booking.status = "confirmed";
    expect(assessPaymentRetryEligibility(booking, [])).toBe(false);
  });

  it("rejects when paid payment exists", () => {
    const booking = paymentFailedBooking(53_000);
    const paid: PaymentRow = {
      id: "pay-1",
      booking_id: booking.id,
      status: "paid",
      provider: "paystack",
      provider_ref: "ref",
      idempotency_key: "pay:1",
      amount_cents: booking.price_cents,
      currency: "ZAR",
      payment_link_expires_at: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(bookingHasPaidPayment([paid])).toBe(true);
    expect(assessPaymentRetryEligibility(booking, [paid])).toBe(false);
  });

  it("rejects missing quote metadata", () => {
    const booking = paymentFailedBooking(53_000);
    booking.metadata = { suburb: "Sea Point" };
    expect(assessPaymentRetryEligibility(booking, [])).toBe(false);
  });

  it("rejects stale stored price", () => {
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const booking = paymentFailedBooking(quote.breakdown.totalCents + 5_000);
    expect(assessPaymentRetryEligibility(booking, [])).toBe(false);
  });

  it("rejects when booking lock is not required", () => {
    process.env.BOOKING_LOCK_REQUIRED = "false";
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const booking = paymentFailedBooking(quote.breakdown.totalCents);
    expect(assessPaymentRetryEligibility(booking, [])).toBe(false);
  });
});
