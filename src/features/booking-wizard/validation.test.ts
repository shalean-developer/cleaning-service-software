import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { INITIAL_WIZARD_STATE } from "./types";
import { filledState } from "./testFixtures";
import {
  canProceedToCheckout,
  validateCleanerStep,
  validateDateTimeStep,
  validateReviewStep,
  validateServiceStep,
  validateWizardStep,
} from "./validation";

describe("booking wizard validation", () => {
  it("requires service on step 1", () => {
    const result = validateServiceStep(INITIAL_WIZARD_STATE);
    expect(result.valid).toBe(false);
    expect(result.errors.serviceSlug).toBeDefined();
  });

  it("blocks past date/time", () => {
    const result = validateDateTimeStep(
      filledState({ date: "2020-01-01", time: "08:00" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.date).toMatch(/future/i);
  });

  it("blocks ineligible selected cleaner", () => {
    const result = validateCleanerStep(
      filledState({
        cleanerPreferenceMode: "selected",
        selectedCleanerId: "cleaner-1",
        availableCleaners: [
          {
            cleanerId: "cleaner-1",
            displayName: "Jane",
            rating: 4,
            serviceAreasSummary: "cape-town",
            availabilitySummary: "Mon",
            eligibilityStatus: "ineligible",
            eligibilityReason: "Outside area",
            eligibilityCode: "outside_service_area",
          },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.selectedCleanerId).toMatch(/Outside area/i);
  });

  it("allows best available without selected cleaner", () => {
    const result = validateCleanerStep(
      filledState({ cleanerPreferenceMode: "best_available" }),
    );
    expect(result.valid).toBe(true);
  });

  it("requires review confirmation and quote", () => {
    expect(validateReviewStep(filledState({ reviewConfirmed: false })).valid).toBe(
      false,
    );
    expect(validateReviewStep(filledState({ quote: null })).valid).toBe(false);
  });

  it("can proceed to checkout only with quote and valid cleaner path", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    expect(
      canProceedToCheckout(
        filledState({ quote: quote.breakdown, reviewConfirmed: true }),
      ),
    ).toBe(true);

    expect(
      canProceedToCheckout(
        filledState({
          quote: quote.breakdown,
          reviewConfirmed: true,
          cleanerPreferenceMode: "selected",
          selectedCleanerId: "x",
          availableCleaners: [
            {
              cleanerId: "x",
              displayName: "X",
              rating: null,
              serviceAreasSummary: "",
              availabilitySummary: "",
              eligibilityStatus: "ineligible",
              eligibilityReason: "Suspended",
              eligibilityCode: "suspended",
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("validates each wizard step in order", () => {
    expect(validateWizardStep("service", filledState()).valid).toBe(true);
    expect(validateWizardStep("checkout", filledState({ quote: null })).valid).toBe(
      false,
    );
  });
});
