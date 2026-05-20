import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { computeCleanerEarningsPreview } from "@/features/pricing/server/computeCleanerEarnings";
import { buildWizardBookingMetadata, wizardStateToPricingInput } from "./buildMetadata";
import { buildLockRequestPayload } from "./lockPayload";
import { customerBookServicePath } from "./bookServiceRoute";
import { buildWizardBookingSummarySnapshot } from "./wizardBookingSummaryDisplay";
import { validateDetailsStep } from "./validation";
import { INITIAL_WIZARD_STATE } from "./types";
import { WIZARD_SERVICE_OPTIONS } from "./constants";

const AIRBNB = "airbnb-cleaning" as const;

function airbnbState(
  overrides: Partial<typeof INITIAL_WIZARD_STATE> = {},
): typeof INITIAL_WIZARD_STATE {
  return {
    ...INITIAL_WIZARD_STATE,
    serviceSlug: AIRBNB,
    bedrooms: 2,
    bathrooms: 1,
    frequency: "once",
    addons: [],
    ...overrides,
  };
}

describe("Airbnb Cleaning launch readiness", () => {
  describe("service route and catalog", () => {
    it("uses canonical book path", () => {
      expect(customerBookServicePath(AIRBNB)).toBe("/customer/book/airbnb-cleaning");
    });

    it("is enabled in wizard options", () => {
      const option = WIZARD_SERVICE_OPTIONS.find((s) => s.slug === AIRBNB);
      expect(option?.enabled).toBe(true);
      expect(option?.label).toBe("Airbnb Cleaning");
    });
  });

  describe("quote calculation", () => {
    it("quotes 2 bed / 1 bath once-off", () => {
      const result = calculateQuote({
        serviceSlug: AIRBNB,
        bedrooms: 2,
        bathrooms: 1,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.breakdown.totalCents).toBe(64_000);
    });

    it("includes add-ons in total", () => {
      const result = calculateQuote({
        serviceSlug: AIRBNB,
        bedrooms: 2,
        bathrooms: 1,
        addons: ["inside-oven"],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.breakdown.totalCents).toBe(82_000);
    });

    it("applies weekly frequency discount", () => {
      const result = calculateQuote({
        serviceSlug: AIRBNB,
        bedrooms: 2,
        bathrooms: 1,
        frequency: "weekly",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.breakdown.discountCents).toBe(6_400);
      expect(result.breakdown.totalCents).toBe(57_600);
    });

    it("rejects regular-only extra rooms", () => {
      const result = calculateQuote({
        serviceSlug: AIRBNB,
        bedrooms: 2,
        bathrooms: 1,
        extraRooms: 1,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("INVALID_EXTRA_ROOMS");
    });

    it("never previews R0 cleaner earnings", () => {
      const result = calculateQuote({
        serviceSlug: AIRBNB,
        bedrooms: 2,
        bathrooms: 1,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.breakdown.cleanerEarnings.perCleanerAmountCents).toBeGreaterThan(0);
      expect(result.breakdown.cleanerEarnings.ruleApplied).toBe("regular_percent_with_min_max");
    });
  });

  describe("wizard validation and payloads", () => {
    it("passes details validation without regular-only fields", () => {
      const result = validateDetailsStep(airbnbState());
      expect(result.valid).toBe(true);
    });

    it("strips regular-only fields from pricing input and lock payload", () => {
      const state = airbnbState({
        date: "2030-06-15",
        time: "09:00",
        extraRooms: 3,
        cleaningIntensity: "heavy",
        equipmentSupply: "shalean",
        requestedTeamSize: 2,
      });
      const pricingInput = wizardStateToPricingInput(state);
      expect(pricingInput).toMatchObject({
        serviceSlug: AIRBNB,
        extraRooms: 0,
        cleaningIntensity: "standard",
        equipmentSupply: "customer",
        requestedTeamSize: 1,
      });

      const quoteResult = calculateQuote(wizardStateToPricingInput(state)!);
      expect(quoteResult.ok).toBe(true);
      if (!quoteResult.ok) return;

      const lock = buildLockRequestPayload(state, quoteResult.breakdown, "ck-1");
      expect("error" in lock).toBe(false);
      if ("error" in lock) return;

      expect(lock).toMatchObject({
        serviceSlug: AIRBNB,
        extraRooms: 0,
        cleaningIntensity: "standard",
        equipmentSupply: "customer",
        requestedTeamSize: 1,
      });
    });

    it("persists airbnb slug in booking metadata quote input", () => {
      const state = airbnbState({ date: "2030-06-15", time: "09:00" });
      const quoteResult = calculateQuote(wizardStateToPricingInput(state)!);
      expect(quoteResult.ok).toBe(true);
      if (!quoteResult.ok) return;

      const metadata = buildWizardBookingMetadata(state, quoteResult.breakdown);
      const quote = metadata.quote as { input: { serviceSlug: string } };
      expect(quote.input.serviceSlug).toBe(AIRBNB);
    });
  });

  describe("sidebar and earnings display helpers", () => {
    it("shows frequency and add-ons in sidebar recap", () => {
      const snapshot = buildWizardBookingSummarySnapshot({
        serviceLabel: "Airbnb Cleaning",
        serviceSlug: AIRBNB,
        date: "2030-06-15",
        time: "09:00",
        suburb: "Sea Point",
        city: "Cape Town",
        bedrooms: 2,
        bathrooms: 1,
        extraRooms: 0,
        propertySizeSqm: null,
        cleaningIntensity: "standard",
        equipmentSupply: "customer",
        requestedTeamSize: 1,
        frequency: "weekly",
        addons: ["balcony"],
      });

      expect(snapshot.secondaryRows.some((r) => r.label === "Turnover cadence")).toBe(true);
      expect(snapshot.secondaryRows.some((r) => r.label === "Turnover extras")).toBe(true);
      expect(snapshot.secondaryRows.some((r) => r.label === "Property")).toBe(true);
      expect(snapshot.secondaryRows.some((r) => r.label === "Intensity")).toBe(false);
      expect(snapshot.secondaryRows.some((r) => r.label === "Team")).toBe(false);
      expect(snapshot.estimatedTotalCents).toBeGreaterThan(0);
    });

    it("computes positive earnings from paid total", () => {
      const preview = computeCleanerEarningsPreview({
        serviceSlug: AIRBNB,
        customerTotalCents: 64_000,
        teamSize: 1,
      });
      expect("perCleanerAmountCents" in preview).toBe(true);
      if (!("perCleanerAmountCents" in preview)) return;
      expect(preview.perCleanerAmountCents).toBeGreaterThan(0);
    });
  });
});
