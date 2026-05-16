import { describe, expect, it } from "vitest";
import { formatZar } from "./parseBookingDisplay";
import {
  EARNINGS_BEING_CALCULATED_LABEL,
  resolveCleanerEarningsDisplay,
} from "./resolveCleanerEarningsDisplay";

function quoteMetadata(perCleanerAmountCents: number) {
  return {
    quote: {
      input: {
        serviceSlug: "deep-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        teamSize: 1,
      },
      breakdown: {
        lineItems: [],
        subtotalCents: 150_000,
        discountCents: 0,
        totalCents: 150_000,
        currency: "ZAR",
      },
      cleanerEarningsPreview: {
        perCleanerAmountCents,
        teamSize: 1,
        totalCleanerPayoutCents: perCleanerAmountCents,
        ruleApplied: "fixed_per_cleaner_deep_moving_carpet",
        metadata: {},
      },
    },
  };
}

describe("resolveCleanerEarningsDisplay", () => {
  it("uses earning_lines payout over customer total and metadata preview", () => {
    const display = resolveCleanerEarningsDisplay({
      currency: "ZAR",
      metadata: quoteMetadata(25_000),
      price_cents: 150_000,
      cleaner_id: "cleaner-1",
      earningLines: [{ payout_amount_cents: 31_800 }],
    });

    expect(display.earningsCents).toBe(31_800);
    expect(display.earningsLabel).toBe(formatZar(31_800));
    expect(display.earningsLabel).not.toBe(formatZar(150_000));
  });

  it("shows preview earnings for offers, not customer total", () => {
    const display = resolveCleanerEarningsDisplay({
      currency: "ZAR",
      metadata: quoteMetadata(25_000),
      price_cents: 150_000,
      cleaner_id: null,
      earningLines: [],
    });

    expect(display.earningsCents).toBe(25_000);
    expect(display.earningsLabel).toBe(formatZar(25_000));
    expect(display.earningsLabel).not.toContain("1,500");
    expect(display.earningsLabel).not.toBe(formatZar(150_000));
  });

  it("never falls back to bookings.price_cents when preview is missing", () => {
    const display = resolveCleanerEarningsDisplay({
      currency: "ZAR",
      metadata: {},
      price_cents: 150_000,
      cleaner_id: null,
      earningLines: [],
    });

    expect(display.earningsCents).toBeNull();
    expect(display.earningsLabel).toBe(EARNINGS_BEING_CALCULATED_LABEL);
    expect(display.earningsLabel).not.toBe(formatZar(150_000));
  });
});
