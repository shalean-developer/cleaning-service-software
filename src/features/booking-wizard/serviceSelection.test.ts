import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { buildLockRequestPayload } from "./lockPayload";
import {
  applyServiceSelectionToWizardState,
  wizardPatchForServiceSelection,
} from "./serviceSelection";
import { filledState } from "./testFixtures";
import { INITIAL_WIZARD_STATE } from "./types";

const serviceSelectionDefaults = {
  extraRooms: 0,
  cleaningIntensity: "standard" as const,
  equipmentSupply: "customer" as const,
  requestedTeamSize: 1 as const,
  carpetStainSeverity: null,
  carpetPetStains: false,
  carpetGoodDryingAirflow: false,
  addons: [] as const,
};

describe("wizardPatchForServiceSelection", () => {
  it("sets regular-cleaning with bedroom and bathroom defaults", () => {
    expect(wizardPatchForServiceSelection("regular-cleaning")).toEqual({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      ...serviceSelectionDefaults,
    });
  });

  it("zeros rooms for office-cleaning", () => {
    expect(wizardPatchForServiceSelection("office-cleaning")).toEqual({
      serviceSlug: "office-cleaning",
      bedrooms: 0,
      bathrooms: 0,
      ...serviceSelectionDefaults,
    });
  });

  it("matches manual selection state on a fresh wizard", () => {
    const manual = applyServiceSelectionToWizardState(INITIAL_WIZARD_STATE, "regular-cleaning");
    const fromUrl = {
      ...INITIAL_WIZARD_STATE,
      ...wizardPatchForServiceSelection("regular-cleaning"),
    };
    expect(fromUrl).toEqual(manual);
  });
});

describe("service URL preselection vs lock payload", () => {
  it("does not change lock payload shape for regular-cleaning", () => {
    const state = filledState();
    const quoteResult = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    });
    expect(quoteResult.ok).toBe(true);
    if (!quoteResult.ok) return;

    const lock = buildLockRequestPayload(state, quoteResult.breakdown, "checkout:test-key");
    expect("error" in lock).toBe(false);
    if ("error" in lock) return;

    expect(lock.serviceSlug).toBe("regular-cleaning");
    expect(lock.bedrooms).toBe(2);
    expect(lock.bathrooms).toBe(1);
    expect(lock.extraRooms).toBe(0);
  });

  it("includes extraRooms in lock payload for regular-cleaning", () => {
    const state = filledState({ extraRooms: 3 });
    const quoteResult = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      extraRooms: 3,
    });
    expect(quoteResult.ok).toBe(true);
    if (!quoteResult.ok) return;

    const lock = buildLockRequestPayload(state, quoteResult.breakdown, "checkout:extra-rooms");
    expect("error" in lock).toBe(false);
    if ("error" in lock) return;

    expect(lock.extraRooms).toBe(3);
    const quoteInput = (lock.bookingMetadata.quote as { input: Record<string, unknown> }).input;
    expect(quoteInput.extraRooms).toBe(3);
  });

  it("includes requestedTeamSize in lock payload for 2-cleaner request", () => {
    const state = filledState({ requestedTeamSize: 2 });
    const quoteResult = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      requestedTeamSize: 2,
    });
    expect(quoteResult.ok).toBe(true);
    if (!quoteResult.ok) return;

    const lock = buildLockRequestPayload(state, quoteResult.breakdown, "checkout:team-2");
    expect("error" in lock).toBe(false);
    if ("error" in lock) return;

    expect(lock.requestedTeamSize).toBe(2);
    const quoteInput = (lock.bookingMetadata.quote as { input: Record<string, unknown> }).input;
    expect(quoteInput.requestedTeamSize).toBe(2);
    expect(quoteInput.teamSize).toBe(1);
  });
});
