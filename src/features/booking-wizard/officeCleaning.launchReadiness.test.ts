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
  getOfficeCleaningStepCopy,
  isOfficeCleaningSlug,
  OFFICE_CLEANING_SLUG,
} from "./officeCleaningDisplay";

const OFFICE = OFFICE_CLEANING_SLUG;

const FORBIDDEN_OFFICE_WORDING = [
  /\bturnover\b/i,
  /\bguest[- ]?ready\b/i,
  /\bhandover\b/i,
  /\bmove[- ]?in\b/i,
  /\brestoration\b/i,
  /\byour home\b/i,
  /\bgate code, pets\b/i,
];

function officeState(
  overrides: Partial<typeof INITIAL_WIZARD_STATE> = {},
): typeof INITIAL_WIZARD_STATE {
  return filledState({
    serviceSlug: OFFICE,
    bedrooms: 0,
    bathrooms: 0,
    officeSizeTier: "medium",
    officeWorkstations: "15",
    propertySizeSqm: 120,
    frequency: "once",
    addons: [],
    ...overrides,
  });
}

function expectNoForbiddenWording(text: string) {
  for (const pattern of FORBIDDEN_OFFICE_WORDING) {
    expect(text).not.toMatch(pattern);
  }
}

describe("Office Cleaning launch readiness", () => {
  describe("service route and wizard", () => {
    it("uses canonical book path", () => {
      expect(customerBookServicePath(OFFICE)).toBe("/customer/book/office-cleaning");
    });

    it("is enabled in wizard options", () => {
      const option = WIZARD_SERVICE_OPTIONS.find((s) => s.slug === OFFICE);
      expect(option?.enabled).toBe(true);
      expect(option?.label).toBe("Office Cleaning");
    });

    it("uses workspace-specific details intro", () => {
      const intro = getDetailsStepIntro(OFFICE);
      expect(intro.title).toBe("Workspace details");
      expectNoForbiddenWording(`${intro.title} ${intro.description}`);
    });

    it("identifies office slug via isOfficeCleaningSlug", () => {
      expect(isOfficeCleaningSlug(OFFICE)).toBe(true);
      expect(isOfficeCleaningSlug("regular-cleaning")).toBe(false);
      expect(getOfficeCleaningStepCopy("airbnb-cleaning")).toBeNull();
    });
  });

  describe("quote and lock (unchanged pricing logic)", () => {
    it("quotes 120 sqm once-off", () => {
      const result = calculateQuote({
        serviceSlug: OFFICE,
        bedrooms: 0,
        bathrooms: 0,
        propertySizeSqm: 120,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.breakdown.totalCents).toBe(74_000);
      expect(result.breakdown.cleanerEarnings.perCleanerAmountCents).toBeGreaterThan(0);
    });

    it("strips regular-only fields in lock payload", () => {
      const state = officeState({
        date: "2030-06-15",
        time: "09:00",
        extraRooms: 2,
        cleaningIntensity: "heavy",
        equipmentSupply: "shalean",
        requestedTeamSize: 2,
      });
      const quote = calculateQuote(wizardStateToPricingInput(state)!);
      expect(quote.ok).toBe(true);
      if (!quote.ok) return;

      const payload = buildLockRequestPayload(state, quote.breakdown, "key-office-1");
      expect("error" in payload).toBe(false);
      if ("error" in payload) return;

      expect(payload.extraRooms).toBe(0);
      expect(payload.cleaningIntensity).toBe("standard");
      expect(payload.equipmentSupply).toBe("customer");
      expect(payload.requestedTeamSize).toBe(1);
      expect(payload.serviceSlug).toBe(OFFICE);
      expect(payload.propertySizeSqm).toBe(120);
    });

    it("snapshots serviceSlug in metadata", () => {
      const quote = calculateQuote({
        serviceSlug: OFFICE,
        bedrooms: 0,
        bathrooms: 0,
        propertySizeSqm: 120,
      });
      expect(quote.ok).toBe(true);
      if (!quote.ok) return;

      const metadata = buildWizardBookingMetadata(officeState(), quote.breakdown);
      const input = (metadata.quote as { input: Record<string, unknown> }).input;
      expect(input.serviceSlug).toBe(OFFICE);
      expect(input.extraRooms).toBe(0);
    });
  });

  describe("validation", () => {
    it("requires office size and workstation selection", () => {
      const missing = validateDetailsStep(
        officeState({ officeSizeTier: null, officeWorkstations: null, propertySizeSqm: null }),
      );
      expect(missing.valid).toBe(false);
      expect(missing.errors.officeSizeTier).toBeDefined();
      expect(missing.errors.officeWorkstations).toBeDefined();

      const valid = validateDetailsStep(officeState());
      expect(valid.valid).toBe(true);
    });
  });

  describe("sidebar recap", () => {
    it("includes workspace location, cadence, and commercial extras labels", () => {
      const snapshot = buildWizardBookingSummarySnapshot({
        serviceLabel: "Office Cleaning",
        serviceSlug: OFFICE,
        date: "2030-06-15",
        time: "09:00",
        suburb: "Sandton",
        city: "Johannesburg",
        bedrooms: 0,
        bathrooms: 0,
        extraRooms: 0,
        propertySizeSqm: 120,
        officeSizeTier: "medium",
        officeWorkstations: "15",
        cleaningIntensity: "standard",
        equipmentSupply: "customer",
        requestedTeamSize: 1,
        frequency: "weekly",
        addons: ["interior-windows"],
      });

      expect(snapshot.secondaryRows.some((r) => r.label === "Workspace")).toBe(true);
      expect(snapshot.secondaryRows.some((r) => r.label === "Service cadence")).toBe(true);
      expect(snapshot.secondaryRows.some((r) => r.label === "Commercial extras")).toBe(true);
      expect(snapshot.secondaryRows.some((r) => r.label === "Intensity")).toBe(false);
      expect(snapshot.secondaryRows.some((r) => r.label === "Team")).toBe(false);
      expect(snapshot.home).toBe("Medium office · 15 workstations");
    });
  });

  describe("commercial copy guardrails", () => {
    it("step copy avoids residential and other-service wording", () => {
      const step = getOfficeCleaningStepCopy(OFFICE);
      expect(step).not.toBeNull();
      if (!step) return;

      const blob = [
        step.mobileDescription,
        step.desktopDescription,
        step.detailsIntro.title,
        step.detailsIntro.description,
        step.accessNotes.placeholder,
        step.notesPlaceholder,
        step.cleaner.subtitle,
      ].join(" ");

      expect(blob).toMatch(/workspace|office|commercial/i);
      expectNoForbiddenWording(blob);
    });
  });
});
