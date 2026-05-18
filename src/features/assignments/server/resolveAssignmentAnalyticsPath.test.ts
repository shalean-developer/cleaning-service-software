import { describe, expect, it } from "vitest";
import {
  mapEnginePathToAnalyticsPath,
  resolveAssignmentAnalyticsPathFromSignals,
} from "./resolveAssignmentAnalyticsPath";

describe("resolveAssignmentAnalyticsPath (7B-1b-min)", () => {
  it("maps metadata assignment paths to analytics families", () => {
    expect(mapEnginePathToAnalyticsPath("selected")).toBe("selected");
    expect(mapEnginePathToAnalyticsPath("best_available")).toBe("best_available");
    expect(mapEnginePathToAnalyticsPath("fallback_best_available")).toBe("best_available");
    expect(mapEnginePathToAnalyticsPath("admin_manual")).toBe("admin_manual");
  });

  it("resolves selected from metadata", () => {
    expect(
      resolveAssignmentAnalyticsPathFromSignals({
        assignment: {
          engineVersion: "2026-05-16-phase8",
          status: "offered",
          path: "selected",
          cleanerId: "c1",
          offerId: "o1",
          reason: null,
          attemptedAt: "2026-05-18T10:00:00.000Z",
        },
      }),
    ).toBe("selected");
  });

  it("resolves admin_manual from metadata", () => {
    expect(
      resolveAssignmentAnalyticsPathFromSignals({
        assignment: {
          engineVersion: "2026-05-16-phase8",
          status: "offered",
          path: "admin_manual",
          cleanerId: "c1",
          offerId: "o1",
          reason: null,
          attemptedAt: "2026-05-18T10:00:00.000Z",
        },
      }),
    ).toBe("admin_manual");
  });

  it("falls back to lock selected preference", () => {
    expect(
      resolveAssignmentAnalyticsPathFromSignals(null, {
        mode: "selected",
        selectedCleanerId: "c1",
      }),
    ).toBe("selected");
  });

  it("falls back to lock best_available preference", () => {
    expect(
      resolveAssignmentAnalyticsPathFromSignals(null, {
        mode: "best_available",
        selectedCleanerId: null,
      }),
    ).toBe("best_available");
  });

  it("returns unknown when path and lock are absent", () => {
    expect(resolveAssignmentAnalyticsPathFromSignals(null, null)).toBe("unknown");
    expect(resolveAssignmentAnalyticsPathFromSignals({}, null)).toBe("unknown");
  });
});
