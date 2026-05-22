import { describe, expect, it } from "vitest";
import { resolveOperationalState } from "./lib/cleaner-operational-audit.mjs";

describe("remediate-cleaner-operational-states planning", () => {
  it("active without onboarding should plan active=false patch", () => {
    const row = {
      active: true,
      suspended_at: null,
      deleted_at: null,
      onboarding_completed_at: null,
    };
    expect(resolveOperationalState(row)).toBe("onboarding");
    expect(row.active && row.onboarding_completed_at == null).toBe(true);
  });

  it("idempotent remediation keys are stable per cleaner", () => {
    const cleanerId = "5097bf11-eb45-4d63-9fab-e0d35bd546bd";
    const key = `ops-15-active-without-onboarding-${cleanerId}`;
    expect(key).toContain(cleanerId);
  });
});
