import { afterEach, describe, expect, it, vi } from "vitest";
import { isZohoMonthlyCreditGovernanceEnabled } from "./zohoMonthlyCreditGovernanceFlag";

function enableMonthlyBillingChain() {
  vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "true");
  vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", "true");
  vi.stubEnv("ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED", "true");
  vi.stubEnv("ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED", "true");
  vi.stubEnv("ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED", "true");
  vi.stubEnv("ZOHO_MONTHLY_COLLECTIONS_ENABLED", "true");
}

describe("isZohoMonthlyCreditGovernanceEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default", () => {
    vi.stubEnv("ZOHO_MONTHLY_CREDIT_GOVERNANCE_ENABLED", undefined);
    expect(isZohoMonthlyCreditGovernanceEnabled()).toBe(false);
  });

  it("requires collections and operations flags", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "true");
    vi.stubEnv("ZOHO_MONTHLY_CREDIT_GOVERNANCE_ENABLED", "true");
    expect(isZohoMonthlyCreditGovernanceEnabled()).toBe(false);
  });

  it.each(["true", "1", "yes"])("is active when full flag chain enabled (%s)", (value) => {
    enableMonthlyBillingChain();
    vi.stubEnv("ZOHO_MONTHLY_CREDIT_GOVERNANCE_ENABLED", value);
    expect(isZohoMonthlyCreditGovernanceEnabled()).toBe(true);
  });
});
