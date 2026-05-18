import { describe, expect, it } from "vitest";
import { assertCleanerOperationalForOffer } from "./cleanerOfferOperationalGuard";
import type { CleanerLifecycleSnapshot } from "@/features/cleaners/server/lifecycle/operationalState";

const NOW = new Date("2026-05-19T12:00:00.000Z");

function snapshot(
  overrides: Partial<CleanerLifecycleSnapshot> = {},
): CleanerLifecycleSnapshot {
  return {
    active: true,
    suspendedAt: null,
    deletedAt: null,
    onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("assertCleanerOperationalForOffer", () => {
  it("passes for active cleaners", () => {
    expect(assertCleanerOperationalForOffer(snapshot(), NOW)).toBeNull();
  });

  it("fails with CLEANER_NOT_OPERATIONAL when snapshot is missing", () => {
    const result = assertCleanerOperationalForOffer(null, NOW);
    expect(result?.code).toBe("CLEANER_NOT_OPERATIONAL");
  });

  it.each([
    ["onboarding", snapshot({ onboardingCompletedAt: null })],
    ["inactive", snapshot({ active: false })],
    [
      "suspended",
      snapshot({ suspendedAt: "2026-05-18T00:00:00.000Z" }),
    ],
    [
      "archived",
      snapshot({ deletedAt: "2026-01-01T00:00:00.000Z", active: false }),
    ],
  ] as const)("fails for %s cleaners", (_label, row) => {
    const result = assertCleanerOperationalForOffer(row, NOW);
    expect(result?.code).toBe("CLEANER_NOT_OPERATIONAL");
  });
});
