import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import {
  cadenceResetPatchForService,
  showFrequencyForService,
  validateCadenceFrequencyForService,
} from "./frequencyVisibility";

describe("frequencyVisibility", () => {
  it("shows frequency for regular, airbnb, and office services", () => {
    expect(showFrequencyForService("regular-cleaning")).toBe(true);
    expect(showFrequencyForService("airbnb-cleaning")).toBe(true);
    expect(showFrequencyForService("office-cleaning")).toBe(true);
  });

  it("hides frequency for deep, moving, and carpet services", () => {
    expect(showFrequencyForService("deep-cleaning")).toBe(false);
    expect(showFrequencyForService("moving-cleaning")).toBe(false);
    expect(showFrequencyForService("carpet-cleaning")).toBe(false);
  });

  it("returns cadence reset patch for non-cadence services", () => {
    expect(cadenceResetPatchForService("deep-cleaning")).toEqual({
      frequency: "once",
      recurringDays: [],
    });
    expect(cadenceResetPatchForService("regular-cleaning")).toBeNull();
  });

  it("rejects non-once cadence for deep cleaning server-side", () => {
    expect(validateCadenceFrequencyForService("deep-cleaning", "weekly")).toContain(
      "once-off",
    );
    expect(validateCadenceFrequencyForService("deep-cleaning", "once")).toBeNull();
  });

  it("documents that deep cleaning weekly quotes are cheaper than once-off at quote layer", () => {
    const once = calculateQuote({
      serviceSlug: "deep-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: "once",
    });
    const weeklyAttempt = calculateQuote({
      serviceSlug: "deep-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: "weekly",
    });

    expect(once.ok).toBe(true);
    expect(weeklyAttempt.ok).toBe(true);
    if (!once.ok || !weeklyAttempt.ok) return;

    expect(weeklyAttempt.breakdown.totalCents).toBeLessThan(once.breakdown.totalCents);
  });
});
