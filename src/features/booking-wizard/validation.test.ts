import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { INITIAL_WIZARD_STATE } from "./types";
import { filledState } from "./testFixtures";
import {
  canProceedToCheckout,
  validateCleanerStep,
  validateDetailsStep,
  validateDateTimeStep,
  validateLocationStep,
  validateReviewStep,
  validateServiceStep,
  validateWizardStep,
} from "./validation";

describe("booking wizard validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires service on step 1", () => {
    const result = validateServiceStep(INITIAL_WIZARD_STATE);
    expect(result.valid).toBe(false);
    expect(result.errors.serviceSlug).toBeDefined();
  });

  it("requires valid mobile on location step", () => {
    const missing = validateLocationStep(
      filledState({ contactPhone: "", profilePhone: null }),
    );
    expect(missing.valid).toBe(false);
    expect(missing.errors.contactPhone).toBeDefined();

    const invalid = validateLocationStep(
      filledState({ contactPhone: "0111234567", profilePhone: null }),
    );
    expect(invalid.valid).toBe(false);
  });

  it("allows location step when profile phone covers empty field", () => {
    const result = validateLocationStep(
      filledState({ contactPhone: "", profilePhone: "+27821234567" }),
    );
    expect(result.valid).toBe(true);
  });

  it("requires valid cleaning intensity for regular-cleaning", () => {
    const valid = validateDetailsStep(
      filledState({ cleaningIntensity: "detailed" }),
    );
    expect(valid.valid).toBe(true);

    const invalid = validateDetailsStep(
      filledState({ cleaningIntensity: "extreme" as "standard" }),
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.cleaningIntensity).toBeDefined();
  });

  it("defaults equipment supply to customer in initial wizard state", () => {
    expect(INITIAL_WIZARD_STATE.equipmentSupply).toBe("customer");
  });

  it("requires valid equipment supply for regular-cleaning", () => {
    const valid = validateDetailsStep(filledState({ equipmentSupply: "shalean" }));
    expect(valid.valid).toBe(true);

    const invalid = validateDetailsStep(
      filledState({ equipmentSupply: "invalid" as "customer" }),
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.equipmentSupply).toBeDefined();
  });

  it("validates extra rooms bounds for regular-cleaning", () => {
    const valid = validateDetailsStep(filledState({ extraRooms: 3 }));
    expect(valid.valid).toBe(true);

    const tooHigh = validateDetailsStep(filledState({ extraRooms: 7 }));
    expect(tooHigh.valid).toBe(false);
    expect(tooHigh.errors.extraRooms).toBeDefined();
  });

  it("validates extra rooms bounds for deep-cleaning", () => {
    const valid = validateDetailsStep(
      filledState({ serviceSlug: "deep-cleaning", extraRooms: 2 }),
    );
    expect(valid.valid).toBe(true);

    const tooHigh = validateDetailsStep(
      filledState({ serviceSlug: "deep-cleaning", extraRooms: 7 }),
    );
    expect(tooHigh.valid).toBe(false);
    expect(tooHigh.errors.extraRooms).toBeDefined();
  });

  it("does not validate extra rooms for carpet-cleaning", () => {
    const result = validateDetailsStep(
      filledState({ serviceSlug: "carpet-cleaning", extraRooms: 99 }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors.extraRooms).toBeUndefined();
  });

  it("blocks past date/time", () => {
    const result = validateDateTimeStep(
      filledState({ date: "2020-01-01", time: "08:00" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.date).toMatch(/future/i);
  });

  it("blocks dates beyond the extended booking window", () => {
    vi.stubEnv("NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED", "true");
    const result = validateDateTimeStep(
      filledState({ date: "2099-01-01", time: "08:00" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.date).toMatch(/within the next 90 days/i);
  });

  it("uses server booking bounds when provided to validation", () => {
    const result = validateDateTimeStep(filledState({ date: "2026-06-10", time: "08:00" }), {
      minDate: "2026-05-18",
      maxDate: "2026-06-01",
      maxAdvanceDays: 14,
      extendedWindowEnabled: false,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.date).toMatch(/14 days/i);
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
