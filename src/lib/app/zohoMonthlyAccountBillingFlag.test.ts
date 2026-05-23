import { afterEach, describe, expect, it, vi } from "vitest";
import { isZohoMonthlyAccountBillingEnabled } from "./zohoMonthlyAccountBillingFlag";

describe("zohoMonthlyAccountBillingFlag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", undefined);
    expect(isZohoMonthlyAccountBillingEnabled()).toBe(false);
  });

  it.each(["true", "1", "yes", "TRUE", "Yes"])("is true for %s", (value) => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", value);
    expect(isZohoMonthlyAccountBillingEnabled()).toBe(true);
  });

  it("is false for other values", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "false");
    expect(isZohoMonthlyAccountBillingEnabled()).toBe(false);
  });
});
