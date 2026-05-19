import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { filledState } from "./testFixtures";
import { mergeWithQuoteInvalidation } from "./quoteInvalidation";

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

  it("clears quote when bedrooms, bathrooms, extraRooms, addons, or intensity change", () => {
    const prev = filledState({ reviewConfirmed: true });
    expect(mergeWithQuoteInvalidation(prev, { bedrooms: 3 }).quote).toBeNull();
    expect(mergeWithQuoteInvalidation(prev, { bathrooms: 2 }).reviewConfirmed).toBe(
      false,
    );
    expect(mergeWithQuoteInvalidation(prev, { extraRooms: 1 }).quote).toBeNull();
    expect(
      mergeWithQuoteInvalidation(prev, { cleaningIntensity: "heavy" }).reviewConfirmed,
    ).toBe(false);
    expect(mergeWithQuoteInvalidation(prev, { addons: ["laundry"] }).quote).toBeNull();
  });

  it("does not clear quote for non-pricing fields", () => {
    const prev = filledState({ reviewConfirmed: true });
    const merged = mergeWithQuoteInvalidation(prev, { suburb: "Newlands" });
    expect(merged).toEqual({ suburb: "Newlands" });
  });

  it("does not clear quote when pricing field is unchanged", () => {
    const prev = filledState({ frequency: "weekly", reviewConfirmed: true });
    const merged = mergeWithQuoteInvalidation(prev, { frequency: "weekly" });
    expect(merged).toEqual({ frequency: "weekly" });
  });
});
