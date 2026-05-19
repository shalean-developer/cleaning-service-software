import { describe, expect, it } from "vitest";

/** Mirrors scripts/ops/lib/mock-cleaner-patterns.mjs */
function isMockCleanerEmail(email: string): boolean {
  if (!email.includes("@")) return false;
  const e = email.toLowerCase();
  if (e.includes("test_e2e")) return true;
  if (e.includes("test_phase")) return true;
  if (/\b(mock|demo)\b/.test(e)) return true;
  if (/\.(mock|demo)@/i.test(e)) return true;
  if (/^(mock|demo)@/i.test(e)) return true;
  if (/[+._](mock|demo)@/i.test(e)) return true;
  return false;
}

function isMockCleanerDisplayName(fullName: string): boolean {
  const n = fullName.toLowerCase();
  if (n.includes("test_e2e") || n.includes("test_phase")) return true;
  if (/\be2e\s+test\b/.test(n)) return true;
  if (/\b(mock|demo)\s+cleaner\b/.test(n)) return true;
  if (/^phase\s+2\s+/i.test(fullName.trim())) return true;
  return false;
}

describe("mock cleaner pattern guards", () => {
  it("flags E2E and phase test cleaner emails", () => {
    expect(isMockCleanerEmail("test_e2e_cleaner@shalean.co.za")).toBe(true);
    expect(isMockCleanerEmail("test_phase2_cleaner_probe@shalean.co.za")).toBe(true);
    expect(isMockCleanerEmail("demo.cleaner@shalean.co.za")).toBe(true);
  });

  it("does not flag production cleaner emails", () => {
    expect(isMockCleanerEmail("jane.doe@shalean.co.za")).toBe(false);
    expect(isMockCleanerEmail("cleaner@company.com")).toBe(false);
    expect(isMockCleanerEmail("latest@shalean.co.za")).toBe(false);
  });

  it("flags E2E display names but not real names", () => {
    expect(isMockCleanerDisplayName("E2E Test Cleaner")).toBe(true);
    expect(isMockCleanerDisplayName("Phase 2 cleaner_purge_abc")).toBe(true);
    expect(isMockCleanerDisplayName("Thabo Mokoena")).toBe(false);
  });
});
