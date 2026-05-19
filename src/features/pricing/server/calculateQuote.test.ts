import { describe, expect, it } from "vitest";
import { calculateQuote } from "./calculateQuote";
import { FIXED_CLEANER_PAYOUT_CENTS, MAX_PERCENT_PAYOUT_CENTS } from "./catalog";

describe("calculateQuote", () => {
  it("quotes regular cleaning with extra rooms line item", () => {
    const result = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      extraRooms: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.totalCents).toBe(67_000);
    const extraRoomsItem = result.breakdown.lineItems.find((i) => i.code === "extra_rooms");
    expect(extraRoomsItem).toMatchObject({
      label: "Extra rooms",
      quantity: 2,
      unitAmountCents: 7_000,
      amountCents: 14_000,
    });
  });

  it("rejects extra rooms above max for regular cleaning", () => {
    const result = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      extraRooms: 7,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_EXTRA_ROOMS");
  });

  it("rejects extra rooms for non-regular services", () => {
    const result = calculateQuote({
      serviceSlug: "deep-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      extraRooms: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_EXTRA_ROOMS");
  });

  it("applies detailed cleaning intensity surcharge before frequency discount", () => {
    const standard = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 2,
    });
    const detailed = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 2,
      cleaningIntensity: "detailed",
    });

    expect(standard.ok).toBe(true);
    expect(detailed.ok).toBe(true);
    if (!standard.ok || !detailed.ok) return;

    expect(detailed.breakdown.totalCents).toBe(67_850);
    const intensityItem = detailed.breakdown.lineItems.find(
      (i) => i.code === "cleaning_intensity",
    );
    expect(intensityItem?.amountCents).toBe(8_850);
    expect(standard.breakdown.totalCents).toBe(59_000);
  });

  it("applies heavy cleaning intensity surcharge", () => {
    const result = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      cleaningIntensity: "heavy",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.breakdown.totalCents).toBe(68_900);
    expect(
      result.breakdown.lineItems.some((i) => i.code === "cleaning_intensity"),
    ).toBe(true);
  });

  it("rejects non-standard intensity for non-regular services", () => {
    const result = calculateQuote({
      serviceSlug: "deep-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      cleaningIntensity: "heavy",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_CLEANING_INTENSITY");
  });

  it("adds cleaning equipment line item when Shalean supplies equipment", () => {
    const customer = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      equipmentSupply: "customer",
    });
    const shalean = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      equipmentSupply: "shalean",
    });

    expect(customer.ok).toBe(true);
    expect(shalean.ok).toBe(true);
    if (!customer.ok || !shalean.ok) return;

    expect(customer.breakdown.totalCents).toBe(53_000);
    expect(shalean.breakdown.totalCents).toBe(63_000);
    expect(
      shalean.breakdown.lineItems.find((i) => i.code === "cleaning_equipment"),
    ).toMatchObject({
      label: "Cleaning equipment",
      amountCents: 10_000,
    });
    expect(
      customer.breakdown.lineItems.some((i) => i.code === "cleaning_equipment"),
    ).toBe(false);
  });

  it("rejects shalean equipment supply for non-regular services", () => {
    const result = calculateQuote({
      serviceSlug: "deep-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      equipmentSupply: "shalean",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_EQUIPMENT_SUPPLY");
  });

  it("raises regular cleaner earnings preview when equipment fee increases total", () => {
    const customer = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      equipmentSupply: "customer",
    });
    const shalean = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      equipmentSupply: "shalean",
    });

    expect(customer.ok).toBe(true);
    expect(shalean.ok).toBe(true);
    if (!customer.ok || !shalean.ok) return;

    expect(shalean.breakdown.cleanerEarnings.perCleanerAmountCents).toBeGreaterThanOrEqual(
      customer.breakdown.cleanerEarnings.perCleanerAmountCents,
    );
  });

  it("raises regular cleaner earnings preview when intensity increases total", () => {
    const standard = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 2,
    });
    const heavy = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 2,
      cleaningIntensity: "heavy",
    });

    expect(standard.ok).toBe(true);
    expect(heavy.ok).toBe(true);
    if (!standard.ok || !heavy.ok) return;

    expect(heavy.breakdown.cleanerEarnings.perCleanerAmountCents).toBeGreaterThanOrEqual(
      standard.breakdown.cleanerEarnings.perCleanerAmountCents,
    );
  });

  it("raises regular cleaner earnings preview when extra rooms increase total", () => {
    const withoutExtra = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    });
    const withExtra = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      extraRooms: 2,
    });

    expect(withoutExtra.ok).toBe(true);
    expect(withExtra.ok).toBe(true);
    if (!withoutExtra.ok || !withExtra.ok) return;

    expect(withExtra.breakdown.totalCents).toBeGreaterThan(
      withoutExtra.breakdown.totalCents,
    );
    expect(withExtra.breakdown.cleanerEarnings.perCleanerAmountCents).toBeGreaterThanOrEqual(
      withoutExtra.breakdown.cleanerEarnings.perCleanerAmountCents,
    );
  });

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

  it("adds team support request surcharge for requestedTeamSize 2 without changing earnings teamSize", () => {
    const base = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      requestedTeamSize: 1,
    });
    const withTeam = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      requestedTeamSize: 2,
    });

    expect(base.ok).toBe(true);
    expect(withTeam.ok).toBe(true);
    if (!base.ok || !withTeam.ok) return;

    expect(withTeam.breakdown.totalCents - base.breakdown.totalCents).toBe(20_000);
    const surcharge = withTeam.breakdown.lineItems.find(
      (i) => i.code === "team_support_request",
    );
    expect(surcharge).toMatchObject({
      label: "Team support request",
      amountCents: 20_000,
    });
    expect(withTeam.breakdown.cleanerEarnings.teamSize).toBe(1);
    expect(base.breakdown.cleanerEarnings.teamSize).toBe(1);
  });

  it("forces requestedTeamSize to 1 for non-regular services", () => {
    const result = calculateQuote({
      serviceSlug: "deep-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      requestedTeamSize: 2,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_REQUESTED_TEAM_SIZE");
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
