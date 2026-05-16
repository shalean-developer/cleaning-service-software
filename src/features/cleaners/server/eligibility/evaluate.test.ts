import { describe, expect, it } from "vitest";
import type { CleanerCandidateRecord, EligibilityQuery } from "../types";
import { evaluateCleanerEligibility } from "./evaluate";
import { parseBookingSlot } from "./slot";

const MONDAY_SLOT = {
  scheduledStart: "2026-05-18T08:00:00.000Z",
  scheduledEnd: "2026-05-18T10:00:00.000Z",
};

function baseCandidate(
  overrides: Partial<CleanerCandidateRecord> = {},
): CleanerCandidateRecord {
  return {
    cleanerId: "11111111-1111-4111-8111-111111111111",
    profileId: "profile-1",
    phone: "+27000000000",
    displayName: "Test Cleaner",
    active: true,
    suspendedAt: null,
    averageRating: 4.5,
    hiredAt: "2024-01-01T00:00:00.000Z",
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

function baseQuery(overrides: Partial<EligibilityQuery> = {}): EligibilityQuery {
  return {
    serviceSlug: "regular-cleaning",
    areaSlug: "cape-town",
    slot: MONDAY_SLOT,
    teamSize: 1,
    ...overrides,
  };
}

describe("evaluateCleanerEligibility", () => {
  const parsed = parseBookingSlot(MONDAY_SLOT)!;

  it("returns active available cleaner as eligible", () => {
    const result = evaluateCleanerEligibility(
      baseCandidate(),
      baseQuery(),
      parsed,
      new Set(),
    );
    expect(result.eligible).toBe(true);
    expect(result.code).toBe("active");
  });

  it("excludes inactive cleaner", () => {
    const result = evaluateCleanerEligibility(
      baseCandidate({ active: false }),
      baseQuery(),
      parsed,
      new Set(),
    );
    expect(result.eligible).toBe(false);
    expect(result.code).toBe("inactive");
  });

  it("excludes suspended cleaner", () => {
    const result = evaluateCleanerEligibility(
      baseCandidate({ suspendedAt: "2020-01-01T00:00:00.000Z" }),
      baseQuery(),
      parsed,
      new Set(),
    );
    expect(result.eligible).toBe(false);
    expect(result.code).toBe("suspended");
  });

  it("excludes cleaner outside service area", () => {
    const result = evaluateCleanerEligibility(
      baseCandidate({ serviceAreas: ["johannesburg"] }),
      baseQuery({ areaSlug: "cape-town" }),
      parsed,
      new Set(),
    );
    expect(result.eligible).toBe(false);
    expect(result.code).toBe("outside_service_area");
  });

  it("excludes cleaner without service capability", () => {
    const result = evaluateCleanerEligibility(
      baseCandidate({ serviceSlugs: ["deep-cleaning"] }),
      baseQuery({ serviceSlug: "regular-cleaning" }),
      parsed,
      new Set(),
    );
    expect(result.eligible).toBe(false);
    expect(result.code).toBe("no_service_capability");
  });

  it("excludes cleaner with schedule conflict", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const result = evaluateCleanerEligibility(
      baseCandidate(),
      baseQuery(),
      parsed,
      new Set([id]),
    );
    expect(result.eligible).toBe(false);
    expect(result.code).toBe("schedule_conflict");
  });

  it("excludes cleaner outside availability window", () => {
    const result = evaluateCleanerEligibility(
      baseCandidate({
        availabilityWindows: [
          { dayOfWeek: 2, startTime: "08:00:00", endTime: "18:00:00", timezone: "Africa/Johannesburg" },
        ],
      }),
      baseQuery(),
      parsed,
      new Set(),
    );
    expect(result.eligible).toBe(false);
    expect(result.code).toBe("outside_availability_window");
  });
});
