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

const MOVING = "moving-cleaning" as const;

function movingState(
  overrides: Partial<typeof INITIAL_WIZARD_STATE> = {},
): typeof INITIAL_WIZARD_STATE {
  return filledState({
    serviceSlug: MOVING,
    bedrooms: 2,
    bathrooms: 1,
    frequency: "once",
    addons: [],
    ...overrides,
  });
}

describe("Move In/Out Cleaning launch readiness", () => {
  describe("service route and wizard", () => {
    it("uses canonical book path", () => {
      expect(customerBookServicePath(MOVING)).toBe("/customer/book/moving-cleaning");
    });

    it("shows Move In/Out label in wizard options", () => {
      const option = WIZARD_SERVICE_OPTIONS.find((s) => s.slug === MOVING);
      expect(option?.enabled).toBe(true);
      expect(option?.label).toBe("Move In/Out Cleaning");
    });

    it("uses move-specific details intro", () => {
      const intro = getDetailsStepIntro(MOVING);
      expect(intro.title).toBe("Property & move preparation");
    });
  });

  describe("quote and lock (unchanged pricing logic)", () => {
    it("quotes 3 bed / 2 bath once-off", () => {
      const result = calculateQuote({
        serviceSlug: MOVING,
        bedrooms: 3,
        bathrooms: 2,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.breakdown.totalCents).toBe(175_000);
      expect(result.breakdown.cleanerEarnings.perCleanerAmountCents).toBeGreaterThan(0);
    });

    it("includes extraRooms and strips regular-only fields in lock payload", () => {
      const state = movingState({
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

      expect(payload.extraRooms).toBe(2);
      expect(payload.cleaningIntensity).toBe("standard");
      expect(payload.equipmentSupply).toBe("customer");
      expect(payload.requestedTeamSize).toBe(1);
      expect(payload.serviceSlug).toBe(MOVING);
    });

    it("snapshots serviceSlug and extraRooms in metadata", () => {
      const quote = calculateQuote({
        serviceSlug: MOVING,
        bedrooms: 2,
        bathrooms: 1,
        extraRooms: 2,
      });
      expect(quote.ok).toBe(true);
      if (!quote.ok) return;

      const metadata = buildWizardBookingMetadata(
        movingState({ extraRooms: 2 }),
        quote.breakdown,
      );
      const input = (metadata.quote as { input: Record<string, unknown> }).input;
      expect(input.serviceSlug).toBe(MOVING);
      expect(input.extraRooms).toBe(2);
    });
  });

  describe("validation", () => {
    it("does not require regular-only detail fields", () => {
      const result = validateDetailsStep(movingState());
      expect(result.valid).toBe(true);
    });
  });

  describe("sidebar recap", () => {
    it("includes property location and inspection extras labels", () => {
      const snapshot = buildWizardBookingSummarySnapshot({
        serviceLabel: "Move In/Out Cleaning",
        serviceSlug: MOVING,
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
        frequency: "once",
        addons: ["balcony"],
      });

      expect(snapshot.secondaryRows.some((r) => r.label === "Property")).toBe(true);
      expect(snapshot.secondaryRows.some((r) => r.label === "Inspection extras")).toBe(true);
      expect(snapshot.secondaryRows.some((r) => r.label === "Intensity")).toBe(false);
    });
  });
});
