import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { buildLockRequestPayload } from "./lockPayload";
import { buildWizardBookingMetadata, wizardStateToPricingInput } from "./buildMetadata";
import { customerBookServicePath } from "./bookServiceRoute";
import { buildWizardBookingSummarySnapshot } from "./wizardBookingSummaryDisplay";
import { validateDetailsStep } from "./validation";
import { filledState } from "./testFixtures";
import { INITIAL_WIZARD_STATE } from "./types";
import { WIZARD_SERVICE_OPTIONS } from "./constants";
import { getDetailsStepIntro } from "./airbnbCleaningDisplay";
import {
  CARPET_SERVICE_STEP_DESCRIPTION_DESKTOP,
  formatCarpetZonesLabel,
  getCarpetCleaningStepCopy,
  isCarpetCleaningSlug,
} from "./carpetCleaningDisplay";
import { formatBedroomBathroomSummary, formatCompactBedBathSummary } from "./reviewDisplay";

const CARPET = "carpet-cleaning" as const;

function carpetState(
  overrides: Partial<typeof INITIAL_WIZARD_STATE> = {},
): typeof INITIAL_WIZARD_STATE {
  return filledState({
    serviceSlug: CARPET,
    bedrooms: 2,
    bathrooms: 1,
    frequency: "once",
    addons: [],
    ...overrides,
  });
}

describe("Carpet Cleaning launch readiness", () => {
  describe("service route and wizard", () => {
    it("uses canonical book path", () => {
      expect(customerBookServicePath(CARPET)).toBe("/customer/book/carpet-cleaning");
    });

    it("shows Carpet Cleaning label in wizard options", () => {
      const option = WIZARD_SERVICE_OPTIONS.find((s) => s.slug === CARPET);
      expect(option?.enabled).toBe(true);
      expect(option?.label).toBe("Carpet Cleaning");
    });

    it("uses carpet-specific details intro", () => {
      const intro = getDetailsStepIntro(CARPET);
      expect(intro.title).toBe("Carpet scope");
      expect(intro.description).toMatch(/Standalone floor-care/i);
      expect(intro.description).not.toMatch(/bedroom|bathroom|turnover|move|office/i);
    });

    it("uses floor-care step 1 desktop copy", () => {
      expect(getCarpetCleaningStepCopy(CARPET)?.desktopDescription).toBe(
        CARPET_SERVICE_STEP_DESCRIPTION_DESKTOP,
      );
    });
  });

  describe("quote and lock (unchanged pricing logic)", () => {
    it("quotes 3 zones once-off", () => {
      const result = calculateQuote({
        serviceSlug: CARPET,
        bedrooms: 3,
        bathrooms: 1,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.breakdown.totalCents).toBe(85_000);
      expect(result.breakdown.cleanerEarnings.perCleanerAmountCents).toBeGreaterThan(0);
      expect(result.breakdown.lineItems.some((i) => i.code === "carpet_zones")).toBe(true);
    });

    it("strips regular-only fields in lock payload", () => {
      const state = carpetState({
        extraRooms: 2,
        cleaningIntensity: "heavy",
        equipmentSupply: "shalean",
        requestedTeamSize: 2,
      });
      const quote = calculateQuote(wizardStateToPricingInput(state)!);
      expect(quote.ok).toBe(true);
      if (!quote.ok) return;

      const payload = buildLockRequestPayload(state, quote.breakdown, "key-1");
      expect("error" in payload).toBe(false);
      if ("error" in payload) return;

      expect(payload.extraRooms).toBe(0);
      expect(payload.cleaningIntensity).toBe("standard");
      expect(payload.equipmentSupply).toBe("customer");
      expect(payload.requestedTeamSize).toBe(1);
      expect(payload.serviceSlug).toBe(CARPET);
    });

    it("snapshots serviceSlug in metadata", () => {
      const quote = calculateQuote({ serviceSlug: CARPET, bedrooms: 2, bathrooms: 1 });
      expect(quote.ok).toBe(true);
      if (!quote.ok) return;

      const metadata = buildWizardBookingMetadata(carpetState(), quote.breakdown);
      const input = (metadata.quote as { input: Record<string, unknown> }).input;
      expect(input.serviceSlug).toBe(CARPET);
    });
  });

  describe("carpet-zone wording", () => {
    it("formats zones not bedrooms in summaries", () => {
      const summary = formatBedroomBathroomSummary(CARPET, 3, 1, null);
      expect(summary.bedroomsLabel).toBe(formatCarpetZonesLabel(3));
      expect(summary.bathroomsLabel).toBeNull();
      expect(summary.bedroomsLabel).not.toMatch(/bedroom/i);
    });

    it("compact summary uses zones", () => {
      const compact = formatCompactBedBathSummary(CARPET, 2, 1, null);
      expect(compact).toBe("2 zones");
      expect(compact).not.toMatch(/bed|bath/i);
    });
  });

  describe("no other service wording leakage", () => {
    it("identifies carpet slug only", () => {
      expect(isCarpetCleaningSlug(CARPET)).toBe(true);
      expect(isCarpetCleaningSlug("airbnb-cleaning")).toBe(false);
      expect(isCarpetCleaningSlug("moving-cleaning")).toBe(false);
      expect(isCarpetCleaningSlug("office-cleaning")).toBe(false);
      expect(isCarpetCleaningSlug("deep-cleaning")).toBe(false);
    });

    it("step copy rejects other services", () => {
      expect(getCarpetCleaningStepCopy("deep-cleaning")).toBeNull();
      expect(getDetailsStepIntro("airbnb-cleaning").title).not.toBe("Carpet scope");
    });
  });

  describe("validation", () => {
    it("does not require regular-only detail fields", () => {
      const result = validateDetailsStep(carpetState());
      expect(result.valid).toBe(true);
    });

    it("uses carpeted room validation messages", () => {
      const result = validateDetailsStep(carpetState({ bedrooms: 0 }));
      expect(result.valid).toBe(false);
      expect(result.errors.bedrooms).toMatch(/carpeted room/i);
    });

    it("rejects more than six carpeted rooms", () => {
      const result = validateDetailsStep(carpetState({ bedrooms: 7 }));
      expect(result.valid).toBe(false);
      expect(result.errors.bedrooms).toMatch(/1 and 6/i);
    });
  });

  describe("sidebar recap", () => {
    it("includes location, visit timing, and floor-care extras", () => {
      const snapshot = buildWizardBookingSummarySnapshot({
        serviceLabel: "Carpet Cleaning",
        serviceSlug: CARPET,
        date: "2026-06-01",
        time: "10:00",
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
        addons: ["interior-walls"],
      });

      expect(snapshot.home).toBe("2 zones");
      expect(snapshot.secondaryRows.some((r) => r.label === "Location")).toBe(true);
      expect(snapshot.secondaryRows.some((r) => r.label === "Visit timing")).toBe(true);
      expect(snapshot.secondaryRows.some((r) => r.label === "Floor-care extras")).toBe(true);
      expect(snapshot.secondaryRows.some((r) => r.label === "Intensity")).toBe(false);
      expect(snapshot.secondaryRows.some((r) => r.label === "Turnover")).toBe(false);
    });
  });
});
