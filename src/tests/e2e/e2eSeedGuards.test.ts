import { describe, expect, it } from "vitest";

/** Mirrors scripts/e2e/lib/constants.mjs — keep in sync for cleanup safety. */
const E2E_PREFIX = "test_e2e_";

function isE2eCompanyName(name: string): boolean {
  return name.startsWith(E2E_PREFIX);
}

function isE2eEmail(email: string): boolean {
  return email.startsWith(E2E_PREFIX);
}

describe("E2E seed guards", () => {
  it("only matches test_e2e_ prefixed company names", () => {
    expect(isE2eCompanyName("test_e2e_customer")).toBe(true);
    expect(isE2eCompanyName("test_phase1_integration_seed")).toBe(false);
    expect(isE2eCompanyName("Acme Corp")).toBe(false);
    expect(isE2eCompanyName("test_e2e_customer")).toBe(true);
  });

  it("only matches test_e2e_ prefixed emails", () => {
    expect(isE2eEmail("test_e2e_customer@shalean.co.za")).toBe(true);
    expect(isE2eEmail("test_phase1_integration_seed@shalean.co.za")).toBe(false);
    expect(isE2eEmail("user@example.com")).toBe(false);
  });

  it("cleanup prefix cannot match production-like names without prefix", () => {
    const productionLike = ["Shalean HQ", "customer", "test_customer", "e2e_customer"];
    for (const name of productionLike) {
      expect(isE2eCompanyName(name)).toBe(false);
    }
  });
});
