import { describe, expect, it } from "vitest";
import { resolveCleanerOperationalState } from "./operationalState";

const NOW = new Date("2026-05-19T12:00:00.000Z");

function baseRow(
  overrides: Partial<Parameters<typeof resolveCleanerOperationalState>[0]> = {},
) {
  return {
    active: true,
    suspendedAt: null,
    deletedAt: null,
    onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveCleanerOperationalState", () => {
  it("returns archived when deleted_at is set", () => {
    expect(
      resolveCleanerOperationalState(
        baseRow({ deletedAt: "2026-01-01T00:00:00.000Z", active: false }),
        NOW,
      ),
    ).toBe("archived");
  });

  it("returns suspended when suspended_at is in the past", () => {
    expect(
      resolveCleanerOperationalState(
        baseRow({ suspendedAt: "2026-05-18T00:00:00.000Z" }),
        NOW,
      ),
    ).toBe("suspended");
  });

  it("does not return suspended when suspended_at is in the future", () => {
    expect(
      resolveCleanerOperationalState(
        baseRow({ suspendedAt: "2026-05-20T00:00:00.000Z" }),
        NOW,
      ),
    ).toBe("active");
  });

  it("returns onboarding when onboarding_completed_at is null", () => {
    expect(
      resolveCleanerOperationalState(baseRow({ onboardingCompletedAt: null }), NOW),
    ).toBe("onboarding");
  });

  it("returns inactive when active is false", () => {
    expect(resolveCleanerOperationalState(baseRow({ active: false }), NOW)).toBe(
      "inactive",
    );
  });

  it("returns active for a fully operational cleaner", () => {
    expect(resolveCleanerOperationalState(baseRow(), NOW)).toBe("active");
  });

  it("prioritizes archived over suspended and inactive", () => {
    expect(
      resolveCleanerOperationalState(
        baseRow({
          deletedAt: "2026-01-01T00:00:00.000Z",
          suspendedAt: "2026-05-18T00:00:00.000Z",
          active: false,
          onboardingCompletedAt: null,
        }),
        NOW,
      ),
    ).toBe("archived");
  });

  it("prioritizes suspended over onboarding and inactive", () => {
    expect(
      resolveCleanerOperationalState(
        baseRow({
          suspendedAt: "2026-05-18T00:00:00.000Z",
          active: false,
          onboardingCompletedAt: null,
        }),
        NOW,
      ),
    ).toBe("suspended");
  });

  it("prioritizes onboarding over inactive", () => {
    expect(
      resolveCleanerOperationalState(
        baseRow({ active: false, onboardingCompletedAt: null }),
        NOW,
      ),
    ).toBe("onboarding");
  });
});
