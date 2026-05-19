import { describe, expect, it } from "vitest";
import { isProvisioningHealthy, resolveCustomerDomainHealth } from "./customerDomainHealth";

describe("resolveCustomerDomainHealth", () => {
  it("marks aligned customer profile as healthy", () => {
    const health = resolveCustomerDomainHealth({
      profileRole: "customer",
      hasCustomerRow: true,
      hasCleanersRow: false,
    });
    expect(health.code).toBe("HEALTHY");
    expect(isProvisioningHealthy(health)).toBe(true);
  });

  it("flags orphan profile when customers row has no profiles record", () => {
    const health = resolveCustomerDomainHealth({
      profileRole: null,
      hasCustomerRow: true,
      hasCleanersRow: false,
    });
    expect(health.code).toBe("ORPHAN_PROFILE");
    expect(isProvisioningHealthy(health)).toBe(false);
  });

  it("flags role mismatch when customers row on admin profile", () => {
    const health = resolveCustomerDomainHealth({
      profileRole: "admin",
      hasCustomerRow: true,
      hasCleanersRow: false,
    });
    expect(health.code).toBe("ROLE_MISMATCH");
    expect(isProvisioningHealthy(health)).toBe(false);
  });

  it("flags provisioning incomplete when customer role has no row", () => {
    const health = resolveCustomerDomainHealth({
      profileRole: "customer",
      hasCustomerRow: false,
      hasCleanersRow: false,
    });
    expect(health.code).toBe("PROVISIONING_INCOMPLETE");
  });
});
