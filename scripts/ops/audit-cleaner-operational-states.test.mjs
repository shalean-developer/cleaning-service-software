import { describe, expect, it } from "vitest";
import {
  auditCleanerOperationalStates,
  isAppDispatchReady,
  resolveOperationalState,
} from "./lib/cleaner-operational-audit.mjs";

function baseCtx(rows, overrides = {}) {
  return {
    rows,
    profileById: new Map(),
    emailByProfileId: new Map(),
    capCount: new Map(),
    availCount: new Map(),
    areaCount: new Map(),
    assignmentHistory: new Map(),
    ...overrides,
  };
}

describe("cleaner-operational-audit", () => {
  it("detects active_without_onboarding as FAIL", () => {
    const id = "c1";
    const row = {
      id,
      profile_id: "p1",
      phone: "+27000000000",
      active: true,
      suspended_at: null,
      deleted_at: null,
      onboarding_completed_at: null,
      suspension_ends_at: null,
      lifecycle_reason: null,
      created_at: "2024-01-01T00:00:00.000Z",
    };
    const ctx = baseCtx([row], {
      profileById: new Map([["p1", { id: "p1", full_name: "Test", role: "cleaner" }]]),
      assignmentHistory: new Map([[id, false]]),
    });
    const report = auditCleanerOperationalStates(ctx);
    expect(report.failCount).toBeGreaterThan(0);
    expect(report.findings.some((f) => f.code === "active_without_onboarding")).toBe(true);
  });

  it("detects active_without_capabilities as WARN", () => {
    const id = "c2";
    const row = {
      id,
      profile_id: "p2",
      phone: "+27000000001",
      active: true,
      suspended_at: null,
      deleted_at: null,
      onboarding_completed_at: "2024-01-01T00:00:00.000Z",
      suspension_ends_at: null,
      lifecycle_reason: null,
      created_at: "2024-01-01T00:00:00.000Z",
    };
    const ctx = baseCtx([row], {
      profileById: new Map([["p2", { id: "p2", full_name: "Active", role: "cleaner" }]]),
      capCount: new Map([[id, 0]]),
      availCount: new Map([[id, 1]]),
      areaCount: new Map([[id, 1]]),
      assignmentHistory: new Map([[id, false]]),
    });
    const report = auditCleanerOperationalStates(ctx);
    expect(report.warnCount).toBeGreaterThan(0);
    expect(report.findings.some((f) => f.code === "active_without_capabilities")).toBe(true);
  });

  it("isAppDispatchReady requires active state and profile config", () => {
    const row = {
      active: true,
      suspended_at: null,
      deleted_at: null,
      onboarding_completed_at: "2024-01-01T00:00:00.000Z",
    };
    expect(isAppDispatchReady(row, 1, 1, 1)).toBe(true);
    expect(isAppDispatchReady(row, 0, 1, 1)).toBe(false);
    expect(
      isAppDispatchReady(
        { ...row, onboarding_completed_at: null },
        1,
        1,
        1,
      ),
    ).toBe(false);
  });

  it("resolveOperationalState prioritizes onboarding over inactive", () => {
    expect(
      resolveOperationalState({
        active: false,
        suspended_at: null,
        deleted_at: null,
        onboarding_completed_at: null,
      }),
    ).toBe("onboarding");
  });
});
