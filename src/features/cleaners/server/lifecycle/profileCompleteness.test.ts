import { describe, expect, it } from "vitest";
import { evaluateCleanerProfileCompleteness } from "./profileCompleteness";

const OPERATIONAL_LIFECYCLE = {
  active: true,
  suspendedAt: null,
  deletedAt: null,
  onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
};

describe("evaluateCleanerProfileCompleteness", () => {
  it("returns 100% and dispatch-ready for complete operational profile", () => {
    const result = evaluateCleanerProfileCompleteness({
      lifecycle: OPERATIONAL_LIFECYCLE,
      phone: "+27000000000",
      serviceAreaSlugs: ["cape-town"],
      capabilitySlugs: ["regular-cleaning"],
      availabilityWindowCount: 5,
    });
    expect(result.completionPercent).toBe(100);
    expect(result.dispatchReady).toBe(true);
    expect(result.missingSections).toEqual([]);
  });

  it("flags onboarding incomplete and not dispatch-ready", () => {
    const result = evaluateCleanerProfileCompleteness({
      lifecycle: {
        active: true,
        suspendedAt: null,
        deletedAt: null,
        onboardingCompletedAt: null,
      },
      phone: "+27000000000",
      serviceAreaSlugs: ["cape-town"],
      capabilitySlugs: ["regular-cleaning"],
      availabilityWindowCount: 3,
    });
    expect(result.missingSections).toContain("onboarding");
    expect(result.dispatchReady).toBe(false);
    expect(result.blockers).toContain("Missing onboarding completion");
  });

  it("scores missing capabilities and availability", () => {
    const result = evaluateCleanerProfileCompleteness({
      lifecycle: OPERATIONAL_LIFECYCLE,
      phone: "+27000000000",
      serviceAreaSlugs: ["cape-town"],
      capabilitySlugs: [],
      availabilityWindowCount: 0,
    });
    expect(result.missingSections).toEqual(
      expect.arrayContaining(["capabilities", "availability"]),
    );
    expect(result.dispatchReady).toBe(false);
    expect(result.completionPercent).toBeLessThan(100);
  });
});
