import { describe, expect, it } from "vitest";
import type { CleanerCandidateRecord, CleanerPublicCard } from "../types";
import { listBookingCleaners, listEligibleCleaners } from "./listEligibleCleaners";
import { pickBestAvailable } from "./rank";
import { assertPublicCleanerCard, toCleanerPublicCard } from "./toPublicCard";
import { evaluateCleanerEligibility } from "./evaluate";
import { parseBookingSlot } from "./slot";

const SLOT = {
  scheduledStart: "2026-05-18T08:00:00.000Z",
  scheduledEnd: "2026-05-18T10:00:00.000Z",
};

function candidate(
  id: string,
  overrides: Partial<CleanerCandidateRecord> = {},
): CleanerCandidateRecord {
  return {
    cleanerId: id,
    profileId: `profile-${id}`,
    phone: "+27000000000",
    displayName: `Cleaner ${id.slice(0, 4)}`,
    active: true,
    suspendedAt: null,
    averageRating: 4,
    hiredAt: "2024-06-01T00:00:00.000Z",
    serviceAreas: ["cape-town"],
    serviceSlugs: ["regular-cleaning"],
    availabilityWindows: [
      {
        dayOfWeek: 1,
        startTime: "08:00:00",
        endTime: "18:00:00",
        timezone: "Africa/Johannesburg",
      },
    ],
    timeOffBlocks: [],
    ...overrides,
  };
}

describe("listEligibleCleaners", () => {
  it("returns selected cleaner eligibility for booking path", () => {
    const selectedId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const result = listBookingCleaners({
      candidates: [
        candidate(selectedId),
        candidate("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", { active: false }),
      ],
      query: {
        serviceSlug: "regular-cleaning",
        areaSlug: "cape-town",
        slot: SLOT,
      },
      conflictingCleanerIds: new Set(),
      selectedCleanerId: selectedId,
    });

    expect("selectedCleaner" in result).toBe(true);
    if (!("selectedCleaner" in result)) return;

    expect(result.selectedCleaner?.eligible).toBe(true);
    expect(result.selectedCleaner?.cleanerId).toBe(selectedId);
  });

  it("marks selected cleaner ineligible with clear reason when inactive", () => {
    const selectedId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const result = listBookingCleaners({
      candidates: [candidate(selectedId, { active: false })],
      query: {
        serviceSlug: "regular-cleaning",
        areaSlug: "cape-town",
        slot: SLOT,
      },
      conflictingCleanerIds: new Set(),
      selectedCleanerId: selectedId,
    });

    if (!("selectedCleaner" in result)) throw new Error("expected booking result");
    expect(result.selectedCleaner?.eligible).toBe(false);
    expect(result.selectedCleaner?.eligibilityReason).toMatch(/not active/i);
  });

  it("picks best available deterministically by rating then cleanerId", () => {
    const lowId = "11111111-1111-4111-8111-111111111111";
    const highId = "22222222-2222-4222-8222-222222222222";
    const cards: CleanerPublicCard[] = [
      {
        cleanerId: highId,
        displayName: "High",
        rating: 5,
        serviceAreasSummary: "cape-town",
        availabilitySummary: "Mon",
        eligibilityStatus: "eligible",
        eligibilityReason: "ok",
        eligibilityCode: "active",
      },
      {
        cleanerId: lowId,
        displayName: "Low",
        rating: 5,
        serviceAreasSummary: "cape-town",
        availabilitySummary: "Mon",
        eligibilityStatus: "eligible",
        eligibilityReason: "ok",
        eligibilityCode: "active",
      },
    ];

    const first = pickBestAvailable(cards);
    const second = pickBestAvailable([...cards].reverse());
    expect(first?.cleanerId).toBe(lowId);
    expect(second?.cleanerId).toBe(lowId);
  });

  it("does not expose private cleaner fields on public cards", () => {
    const parsed = parseBookingSlot(SLOT)!;
    const record = candidate("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const evaluation = evaluateCleanerEligibility(
      record,
      {
        serviceSlug: "regular-cleaning",
        areaSlug: "cape-town",
        slot: SLOT,
      },
      parsed,
      new Set(),
    );
    const card = toCleanerPublicCard(record, evaluation);
    assertPublicCleanerCard(card as unknown as Record<string, unknown>);
    expect(card).not.toHaveProperty("phone");
    expect(card).not.toHaveProperty("profileId");
    expect(card).not.toHaveProperty("email");
  });

  it("includes earnings preview only for eligible cleaners when pricing input provided", () => {
    const result = listEligibleCleaners({
      candidates: [candidate("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")],
      query: {
        serviceSlug: "regular-cleaning",
        areaSlug: "cape-town",
        slot: SLOT,
      },
      conflictingCleanerIds: new Set(),
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 2,
      },
    });

    if ("ok" in result) throw new Error("unexpected failure");
    expect(result.cleaners[0]?.estimatedEarningsPreviewCents).toBeGreaterThan(0);
  });
});
