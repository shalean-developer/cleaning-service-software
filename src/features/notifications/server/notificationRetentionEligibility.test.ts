import { describe, expect, it } from "vitest";
import {
  buildUtcHourCoverageSet,
  countWorkerRunsRollupEligibility,
  isWorkerRunEligibleWithRollupCoverage,
} from "./notificationRetentionEligibility";

describe("notificationRetentionEligibility", () => {
  const cutoff = "2026-01-01T00:00:00.000Z";
  const covered = buildUtcHourCoverageSet([
    "2025-12-31T10:00:00.000Z",
    "2025-12-31T11:00:00.000Z",
  ]);

  it("marks run eligible when older than cutoff and hour bucket exists", () => {
    expect(
      isWorkerRunEligibleWithRollupCoverage(
        "2025-12-31T10:30:00.000Z",
        cutoff,
        covered,
      ),
    ).toBe(true);
  });

  it("marks run protected when hour bucket missing", () => {
    expect(
      isWorkerRunEligibleWithRollupCoverage(
        "2025-12-31T12:30:00.000Z",
        cutoff,
        covered,
      ),
    ).toBe(false);
  });

  it("marks run protected when within retention window", () => {
    expect(
      isWorkerRunEligibleWithRollupCoverage(
        "2026-02-01T10:00:00.000Z",
        cutoff,
        covered,
      ),
    ).toBe(false);
  });

  it("aggregates eligible and protected counts", () => {
    const result = countWorkerRunsRollupEligibility(
      [
        "2025-12-31T10:15:00.000Z",
        "2025-12-31T12:15:00.000Z",
        "2026-02-01T10:00:00.000Z",
      ],
      cutoff,
      covered,
    );
    expect(result.eligible).toBe(1);
    expect(result.protectedMissingRollup).toBe(1);
  });
});
