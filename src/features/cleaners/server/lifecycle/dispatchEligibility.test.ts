import { describe, expect, it } from "vitest";
import {
  evaluateOperationalDispatchGate,
  isCleanerOperationalForDispatch,
  lifecycleSnapshotFromCandidate,
} from "./dispatchEligibility";

const NOW = new Date("2026-06-01T12:00:00.000Z");

describe("dispatchEligibility", () => {
  it("isCleanerOperationalForDispatch is true only for active operational state", () => {
    expect(
      isCleanerOperationalForDispatch(
        lifecycleSnapshotFromCandidate({
          active: true,
          suspendedAt: null,
          deletedAt: null,
          onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
        }),
        NOW,
      ),
    ).toBe(true);

    expect(
      isCleanerOperationalForDispatch(
        lifecycleSnapshotFromCandidate({
          active: true,
          suspendedAt: null,
          deletedAt: null,
          onboardingCompletedAt: null,
        }),
        NOW,
      ),
    ).toBe(false);
  });

  it("evaluateOperationalDispatchGate returns onboarding block before inactive", () => {
    const block = evaluateOperationalDispatchGate(
      lifecycleSnapshotFromCandidate({
        active: false,
        suspendedAt: null,
        deletedAt: null,
        onboardingCompletedAt: null,
      }),
      NOW,
    );
    expect(block?.code).toBe("onboarding");
  });

  it("evaluateOperationalDispatchGate returns inactive when onboarding is complete", () => {
    const block = evaluateOperationalDispatchGate(
      lifecycleSnapshotFromCandidate({
        active: false,
        suspendedAt: null,
        deletedAt: null,
        onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
      }),
      NOW,
    );
    expect(block?.code).toBe("inactive");
  });
});
