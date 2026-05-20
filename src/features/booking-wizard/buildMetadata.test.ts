import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { buildWizardBookingMetadata } from "./buildMetadata";
import { filledState } from "./testFixtures";

describe("buildWizardBookingMetadata", () => {
  it("snapshots contactPhone in booking metadata", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const metadata = buildWizardBookingMetadata(
      filledState({ contactPhone: "082 123 4567" }),
      quote.breakdown,
    );

    expect(metadata.contactPhone).toBe("+27821234567");
  });

  it("omits contactPhone when unresolved", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const metadata = buildWizardBookingMetadata(
      filledState({ contactPhone: "", profilePhone: null }),
      quote.breakdown,
    );

    expect(metadata.contactPhone).toBeUndefined();
  });

  it("snapshots extraRooms in quote.input for regular-cleaning", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      extraRooms: 2,
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const metadata = buildWizardBookingMetadata(
      filledState({ extraRooms: 2 }),
      quote.breakdown,
    );
    const quoteInput = (metadata.quote as { input: Record<string, unknown> }).input;
    expect(quoteInput.extraRooms).toBe(2);
  });

  it("snapshots equipmentSupply in quote.input for regular-cleaning", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      equipmentSupply: "shalean",
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const metadata = buildWizardBookingMetadata(
      filledState({ equipmentSupply: "shalean" }),
      quote.breakdown,
    );
    const quoteInput = (metadata.quote as { input: Record<string, unknown> }).input;
    expect(quoteInput.equipmentSupply).toBe("shalean");
  });

  it("snapshots cleaningIntensity in quote.input for regular-cleaning", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      cleaningIntensity: "detailed",
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const metadata = buildWizardBookingMetadata(
      filledState({ cleaningIntensity: "detailed" }),
      quote.breakdown,
    );
    const quoteInput = (metadata.quote as { input: Record<string, unknown> }).input;
    expect(quoteInput.cleaningIntensity).toBe("detailed");
  });

  it("snapshots carpetDetails in metadata for carpet-cleaning", () => {
    const quote = calculateQuote({
      serviceSlug: "carpet-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const metadata = buildWizardBookingMetadata(
      filledState({
        serviceSlug: "carpet-cleaning",
        carpetStainSeverity: "noticeable",
        carpetPetStains: true,
        carpetGoodDryingAirflow: false,
      }),
      quote.breakdown,
    );

    expect(metadata.carpetDetails).toEqual({
      stainSeverity: "noticeable",
      petStains: true,
      goodDryingAirflow: false,
    });
  });

  it("snapshots requestedTeamSize in quote.input for regular-cleaning", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      requestedTeamSize: 2,
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const metadata = buildWizardBookingMetadata(
      filledState({ requestedTeamSize: 2 }),
      quote.breakdown,
    );
    const quoteInput = (metadata.quote as { input: Record<string, unknown> }).input;
    expect(quoteInput.requestedTeamSize).toBe(2);
    expect(quoteInput.teamSize).toBe(1);
  });
});
