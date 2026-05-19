import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { filledState } from "./testFixtures";
import {
  mergeWithQuoteInvalidation,
  shouldRedirectCheckoutWithoutQuote,
} from "./quoteInvalidation";

describe("mergeWithQuoteInvalidation", () => {
  it("clears quote and reviewConfirmed when frequency changes", () => {
    const quoteResult = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: "once",
    });
    expect(quoteResult.ok).toBe(true);
    if (!quoteResult.ok) return;

    const prev = filledState({
      quote: quoteResult.breakdown,
      reviewConfirmed: true,
    });
    const merged = mergeWithQuoteInvalidation(prev, { frequency: "weekly" });
    expect(merged).toEqual({
      frequency: "weekly",
      quote: null,
      reviewConfirmed: false,
    });
  });

  it("clears quote when extraRooms changes", () => {
    const prev = filledState({ reviewConfirmed: true });
    expect(mergeWithQuoteInvalidation(prev, { extraRooms: 1 }).quote).toBeNull();
    expect(
      mergeWithQuoteInvalidation(prev, { extraRooms: 1 }).reviewConfirmed,
    ).toBe(false);
  });

  it("clears quote when cleaningIntensity changes", () => {
    const prev = filledState({ reviewConfirmed: true });
    expect(
      mergeWithQuoteInvalidation(prev, { cleaningIntensity: "heavy" }).quote,
    ).toBeNull();
    expect(
      mergeWithQuoteInvalidation(prev, { cleaningIntensity: "heavy" })
        .reviewConfirmed,
    ).toBe(false);
  });

  it("clears quote when equipmentSupply changes", () => {
    const prev = filledState({ reviewConfirmed: true });
    expect(
      mergeWithQuoteInvalidation(prev, { equipmentSupply: "shalean" }).quote,
    ).toBeNull();
  });

  it("clears quote when requestedTeamSize changes", () => {
    const prev = filledState({ reviewConfirmed: true });
    expect(
      mergeWithQuoteInvalidation(prev, { requestedTeamSize: 2 }).quote,
    ).toBeNull();
  });

  it("clears quote when addons change", () => {
    const prev = filledState({ reviewConfirmed: true });
    expect(mergeWithQuoteInvalidation(prev, { addons: ["laundry"] }).quote).toBeNull();
  });

  it("clears quote when schedule date or time changes", () => {
    const prev = filledState({ reviewConfirmed: true });
    expect(mergeWithQuoteInvalidation(prev, { date: "2030-06-01" }).quote).toBeNull();
    expect(mergeWithQuoteInvalidation(prev, { time: "14:00" }).quote).toBeNull();
  });

  it("clears quote when bedrooms, bathrooms, or serviceSlug change", () => {
    const prev = filledState({ reviewConfirmed: true });
    expect(mergeWithQuoteInvalidation(prev, { bedrooms: 3 }).quote).toBeNull();
    expect(mergeWithQuoteInvalidation(prev, { bathrooms: 2 }).reviewConfirmed).toBe(
      false,
    );
    expect(
      mergeWithQuoteInvalidation(prev, { serviceSlug: "office-cleaning" }).quote,
    ).toBeNull();
  });

  it("does not clear quote for non-pricing fields", () => {
    const prev = filledState({ reviewConfirmed: true });
    expect(mergeWithQuoteInvalidation(prev, { suburb: "Newlands" })).toEqual({
      suburb: "Newlands",
    });
    expect(mergeWithQuoteInvalidation(prev, { locationNotes: "Gate code 1234" })).toEqual({
      locationNotes: "Gate code 1234",
    });
    expect(
      mergeWithQuoteInvalidation(prev, { specialInstructions: "Pet friendly" }),
    ).toEqual({ specialInstructions: "Pet friendly" });
    expect(
      mergeWithQuoteInvalidation(prev, {
        cleanerPreferenceMode: "selected",
        selectedCleanerId: "cleaner-1",
      }),
    ).toEqual({
      cleanerPreferenceMode: "selected",
      selectedCleanerId: "cleaner-1",
    });
  });

  it("does not clear quote when pricing field is unchanged", () => {
    const prev = filledState({ frequency: "weekly", reviewConfirmed: true });
    expect(mergeWithQuoteInvalidation(prev, { frequency: "weekly" })).toEqual({
      frequency: "weekly",
    });
    expect(
      mergeWithQuoteInvalidation(prev, { equipmentSupply: "customer" }),
    ).toEqual({ equipmentSupply: "customer" });
  });
});

describe("shouldRedirectCheckoutWithoutQuote", () => {
  it("is true on checkout without quote", () => {
    expect(
      shouldRedirectCheckoutWithoutQuote(
        filledState({ step: "checkout", quote: null }),
      ),
    ).toBe(true);
  });

  it("is false on checkout with quote or other steps", () => {
    const quoteResult = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: "once",
    });
    expect(quoteResult.ok).toBe(true);
    if (!quoteResult.ok) return;

    expect(
      shouldRedirectCheckoutWithoutQuote(
        filledState({ step: "checkout", quote: quoteResult.breakdown }),
      ),
    ).toBe(false);
    expect(
      shouldRedirectCheckoutWithoutQuote(
        filledState({ step: "review", quote: null }),
      ),
    ).toBe(false);
  });
});
