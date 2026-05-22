import { describe, expect, it } from "vitest";
import { resolveCleanerOperationalState } from "./operationalState";

describe("operational cleaner metrics", () => {
  it("excludes onboarding cleaners from operational state", () => {
    expect(
      resolveCleanerOperationalState({
        active: true,
        suspendedAt: null,
        deletedAt: null,
        onboardingCompletedAt: null,
      }),
    ).toBe("onboarding");
  });

  it("counts only fully active lifecycle as operational", () => {
    expect(
      resolveCleanerOperationalState({
        active: true,
        suspendedAt: null,
        deletedAt: null,
        onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
      }),
    ).toBe("active");
  });
});
