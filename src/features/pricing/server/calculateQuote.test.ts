import { describe, expect, it } from "vitest";
import { calculateQuote } from "./calculateQuote";
import { FIXED_CLEANER_PAYOUT_CENTS, MAX_PERCENT_PAYOUT_CENTS } from "./catalog";

describe("calculateQuote", () => {
  it("quotes regular cleaning total for 2 bed / 2 bath", () => {
    const result = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.totalCents).toBe(59_000);
    expect(result.breakdown.currency).toBe("ZAR");
    expect(result.breakdown.lineItems.some((i) => i.code === "service_base")).toBe(true);
  });

  it("quotes deep cleaning total for 1 bed / 1 bath", () => {
    const result = calculateQuote({
      serviceSlug: "deep-cleaning",
      bedrooms: 1,
      bathrooms: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.totalCents).toBe(85_000);
    expect(result.breakdown.cleanerEarnings.perCleanerAmountCents).toBe(
      FIXED_CLEANER_PAYOUT_CENTS,
    );
    expect(result.breakdown.cleanerEarnings.ruleApplied).toBe(
      "fixed_per_cleaner_deep_moving_carpet",
    );
  });

  it("quotes moving cleaning total for 3 bed / 2 bath", () => {
    const result = calculateQuote({
      serviceSlug: "moving-cleaning",
      bedrooms: 3,
      bathrooms: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.totalCents).toBe(175_000);
  });

  it("quotes airbnb cleaning total for 2 bed / 1 bath", () => {
    const result = calculateQuote({
      serviceSlug: "airbnb-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.totalCents).toBe(64_000);
  });

  it("applies weekly frequency discount on regular cleaning", () => {
    const result = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 2,
      frequency: "weekly",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.subtotalCents).toBe(59_000);
    expect(result.breakdown.discountCents).toBe(5_900);
    expect(result.breakdown.totalCents).toBe(53_100);
    expect(
      result.breakdown.lineItems.some((i) => i.code === "frequency_discount"),
    ).toBe(true);
  });

  it("includes add-ons in the total", () => {
    const result = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 1,
      bathrooms: 1,
      addons: ["inside-fridge", "laundry"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.totalCents).toBe(45_000 + 15_000 + 12_000);
    expect(result.breakdown.lineItems.filter((i) => i.code.startsWith("addon_"))).toHaveLength(
      2,
    );
  });

  it("rejects unknown service", () => {
    const result = calculateQuote({
      serviceSlug: "unknown-service" as "regular-cleaning",
      bedrooms: 1,
      bathrooms: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("UNKNOWN_SERVICE");
  });

  it("rejects zero bedrooms for residential service", () => {
    const result = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 0,
      bathrooms: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_BEDROOMS");
  });

  it("rejects unsafe cleaner earnings when team payout exceeds customer total", () => {
    const result = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 1,
      bathrooms: 1,
      teamSize: 2,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("UNSAFE_CLEANER_EARNINGS");
  });

  it("enforces regular cleaner earnings min and max for known tenure", () => {
    const underFour = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 2,
      cleanerTenureMonths: 2,
    });
    expect(underFour.ok).toBe(true);
    if (!underFour.ok) return;
    expect(underFour.breakdown.cleanerEarnings.perCleanerAmountCents).toBe(
      MAX_PERCENT_PAYOUT_CENTS,
    );

    const fourPlus = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 1,
      bathrooms: 1,
      cleanerTenureMonths: 6,
    });
    expect(fourPlus.ok).toBe(true);
    if (!fourPlus.ok) return;
    expect(fourPlus.breakdown.cleanerEarnings.perCleanerAmountCents).toBe(
      MAX_PERCENT_PAYOUT_CENTS,
    );
  });

  it("uses conservative preview when cleaner tenure is unknown", () => {
    const result = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.cleanerEarnings.metadata.fallbackReason).toBe(
      "cleaner_tenure_unknown_conservative_60_percent",
    );
    expect(result.breakdown.cleanerEarnings.perCleanerAmountCents).toBeGreaterThan(0);
  });

  it("previews fixed team payout per cleaner on deep cleaning", () => {
    const result = calculateQuote({
      serviceSlug: "deep-cleaning",
      bedrooms: 2,
      bathrooms: 2,
      teamSize: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.cleanerEarnings.perCleanerAmountCents).toBe(
      FIXED_CLEANER_PAYOUT_CENTS,
    );
    expect(result.breakdown.cleanerEarnings.totalCleanerPayoutCents).toBe(50_000);
    expect(result.breakdown.cleanerEarnings.ruleApplied).toBe("team_fixed_per_cleaner");
  });

  it("never returns R0 earnings preview for a valid paid quote", () => {
    const slugs = [
      "regular-cleaning",
      "deep-cleaning",
      "moving-cleaning",
      "airbnb-cleaning",
      "office-cleaning",
      "carpet-cleaning",
    ] as const;

    for (const serviceSlug of slugs) {
      const result = calculateQuote({
        serviceSlug,
        bedrooms: serviceSlug === "office-cleaning" ? 0 : 2,
        bathrooms: serviceSlug === "office-cleaning" ? 0 : 2,
        propertySizeSqm: serviceSlug === "office-cleaning" ? 120 : undefined,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.breakdown.cleanerEarnings.perCleanerAmountCents).toBeGreaterThan(0);
      expect(result.breakdown.cleanerEarnings.totalCleanerPayoutCents).toBeGreaterThan(0);
    }
  });

  it("quotes office cleaning with property size", () => {
    const result = calculateQuote({
      serviceSlug: "office-cleaning",
      bedrooms: 0,
      bathrooms: 0,
      propertySizeSqm: 120,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.totalCents).toBe(60_000 + 70 * 200);
  });

  it("quotes carpet cleaning by bedroom zones", () => {
    const result = calculateQuote({
      serviceSlug: "carpet-cleaning",
      bedrooms: 3,
      bathrooms: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.totalCents).toBe(40_000 + 3 * 15_000);
  });
});
