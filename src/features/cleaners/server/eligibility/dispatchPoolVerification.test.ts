import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateCleanerEligibility } from "./evaluate";
import { parseBookingSlot } from "./slot";

const SLOT = {
  scheduledStart: "2026-06-02T08:00:00.000Z",
  scheduledEnd: "2026-06-02T10:00:00.000Z",
};

const DISPATCH_ENTRY_FILES = [
  "src/features/cleaners/server/eligibility/listEligibleCleaners.ts",
  "src/features/assignments/server/eligibilityForAssignment.ts",
  "src/features/bookings/server/lock/validateCleanerPreference.ts",
  "src/features/cleaners/server/getAvailableCleaners.ts",
];

describe("dispatch pool verification", () => {
  const parsed = parseBookingSlot(SLOT)!;

  it("excludes onboarding cleaners from evaluateCleanerEligibility", () => {
    const result = evaluateCleanerEligibility(
      {
        cleanerId: "11111111-1111-4111-8111-111111111111",
        profileId: "p1",
        phone: "+27000000000",
        displayName: "Onboarding",
        active: true,
        suspendedAt: null,
        deletedAt: null,
        onboardingCompletedAt: null,
        averageRating: null,
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
      },
      {
        serviceSlug: "regular-cleaning",
        areaSlug: "cape-town",
        slot: SLOT,
      },
      parsed,
      new Set(),
    );
    expect(result.eligible).toBe(false);
    expect(result.code).toBe("onboarding");
  });

  it("excludes suspended and archived cleaners", () => {
    for (const suspendedAt of ["2020-01-01T00:00:00.000Z"]) {
      const suspended = evaluateCleanerEligibility(
        {
          cleanerId: "11111111-1111-4111-8111-111111111111",
          profileId: "p1",
          phone: null,
          displayName: "S",
          active: true,
          suspendedAt,
          deletedAt: null,
          onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
          averageRating: null,
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
        },
        { serviceSlug: "regular-cleaning", areaSlug: "cape-town", slot: SLOT },
        parsed,
        new Set(),
      );
      expect(suspended.eligible).toBe(false);
      expect(suspended.code).toBe("suspended");
    }

    const archived = evaluateCleanerEligibility(
      {
        cleanerId: "11111111-1111-4111-8111-111111111111",
        profileId: "p1",
        phone: null,
        displayName: "A",
        active: true,
        suspendedAt: null,
        deletedAt: "2026-01-01T00:00:00.000Z",
        onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
        averageRating: null,
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
      },
      { serviceSlug: "regular-cleaning", areaSlug: "cape-town", slot: SLOT },
      parsed,
      new Set(),
    );
    expect(archived.eligible).toBe(false);
    expect(archived.code).toBe("archived");
  });

  it("dispatch entry points use evaluateCleanerEligibility or listEligibleCleaners", () => {
    for (const relPath of DISPATCH_ENTRY_FILES) {
      const source = readFileSync(resolve(process.cwd(), relPath), "utf8");
      const usesGate =
        source.includes("evaluateCleanerEligibility") ||
        source.includes("listEligibleCleaners");
      expect(usesGate, relPath).toBe(true);
    }
  });

  it("repository excludes archived rows before eligibility", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/cleaners/server/repository.ts"),
      "utf8",
    );
    expect(source).toContain("deleted_at == null");
    expect(source).toContain("onboarding_completed_at");
  });
});
