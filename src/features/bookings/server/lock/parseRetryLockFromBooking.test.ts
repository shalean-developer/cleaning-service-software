import { describe, expect, it } from "vitest";
import { buildBookingQuoteMetadata } from "@/features/pricing/server/metadata";
import type { BookingRow } from "@/lib/database/types";
import { parseRetryLockFromBooking } from "./parseRetryLockFromBooking";

function bookingRow(overrides: Partial<BookingRow> = {}): BookingRow {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const end = new Date(future.getTime() + 2 * 60 * 60 * 1000);
  const metadata = buildBookingQuoteMetadata(
    { serviceSlug: "regular-cleaning", bedrooms: 2, bathrooms: 1 },
    {
      pricingVersion: "2026-05-16-mvp",
      currency: "ZAR",
      serviceSlug: "regular-cleaning",
      lineItems: [],
      subtotalCents: 53_000,
      discountCents: 0,
      totalCents: 53_000,
      frequency: "once",
      cleanerEarnings: {
        perCleanerAmountCents: 25_000,
        teamSize: 1,
        totalCleanerPayoutCents: 25_000,
        ruleApplied: "test",
        metadata: {},
      },
      metadata: {},
    },
  );

  return {
    id: "booking-1",
    customer_id: "customer-1",
    cleaner_id: null,
    service_id: null,
    status: "payment_failed",
    scheduled_start: future.toISOString(),
    scheduled_end: end.toISOString(),
    assignment_dispatch_at: null,
    price_cents: 53_000,
    currency: "ZAR",
    series_id: null,
    metadata: { ...metadata, suburb: "Sea Point" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("parseRetryLockFromBooking", () => {
  it("parses wizard-shaped quote metadata", () => {
    const parsed = parseRetryLockFromBooking(bookingRow());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.pricingInput.serviceSlug).toBe("regular-cleaning");
    expect(parsed.pricingInput.extraRooms).toBe(0);
    expect(parsed.areaSlug).toBe("sea-point");
  });

  it("defaults cleaningIntensity to standard when missing from quote.input", () => {
    const parsed = parseRetryLockFromBooking(bookingRow());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.pricingInput.cleaningIntensity).toBe("standard");
  });

  it("parses cleaningIntensity from quote.input", () => {
    const row = bookingRow();
    const metadata = row.metadata as Record<string, unknown>;
    const quote = metadata.quote as Record<string, unknown>;
    const input = quote.input as Record<string, unknown>;
    input.cleaningIntensity = "heavy";

    const parsed = parseRetryLockFromBooking(row);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.pricingInput.cleaningIntensity).toBe("heavy");
  });

  it("parses extraRooms from quote.input", () => {
    const row = bookingRow();
    const metadata = row.metadata as Record<string, unknown>;
    const quote = metadata.quote as Record<string, unknown>;
    const input = quote.input as Record<string, unknown>;
    input.extraRooms = 3;

    const parsed = parseRetryLockFromBooking(row);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.pricingInput.extraRooms).toBe(3);
  });

  it("reads equipmentSupply from quote.input", () => {
    const row = bookingRow();
    const metadata = row.metadata as Record<string, unknown>;
    const quote = metadata.quote as Record<string, unknown>;
    const input = quote.input as Record<string, unknown>;
    input.equipmentSupply = "shalean";

    const parsed = parseRetryLockFromBooking(row);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.pricingInput.equipmentSupply).toBe("shalean");
  });

  it("defaults missing equipmentSupply to customer", () => {
    const parsed = parseRetryLockFromBooking(bookingRow());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.pricingInput.equipmentSupply).toBe("customer");
  });

  it("parses requestedTeamSize from quote.input and keeps teamSize at 1", () => {
    const row = bookingRow();
    const metadata = row.metadata as Record<string, unknown>;
    const quote = metadata.quote as Record<string, unknown>;
    const input = quote.input as Record<string, unknown>;
    input.requestedTeamSize = 2;

    const parsed = parseRetryLockFromBooking(row);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.pricingInput.requestedTeamSize).toBe(2);
    expect(parsed.pricingInput.teamSize).toBe(1);
  });

  it("defaults requestedTeamSize to 1 when missing", () => {
    const parsed = parseRetryLockFromBooking(bookingRow());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.pricingInput.requestedTeamSize).toBe(1);
  });

  it("rejects missing quote.input", () => {
    const row = bookingRow({ metadata: { suburb: "Sea Point" } });
    const parsed = parseRetryLockFromBooking(row);
    expect(parsed.ok).toBe(false);
  });
});
