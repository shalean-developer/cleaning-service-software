import { afterEach, describe, expect, it, vi } from "vitest";
import { isZohoMonthlyServiceAuthorizationEnabled } from "./zohoMonthlyServiceAuthorizationFlag";

describe("isZohoMonthlyServiceAuthorizationEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", undefined);
    expect(isZohoMonthlyServiceAuthorizationEnabled()).toBe(false);
  });

  it("is false when only service authorization flag is on", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "true");
    expect(isZohoMonthlyServiceAuthorizationEnabled()).toBe(false);
  });

  it("is false when only monthly billing flag is on", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "true");
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "false");
    expect(isZohoMonthlyServiceAuthorizationEnabled()).toBe(false);
  });

  it.each(["true", "1", "yes"])(
    "is active when both flags are enabled (%s)",
    (value) => {
      vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", value);
      expect(isZohoMonthlyServiceAuthorizationEnabled()).toBe(true);
    },
  );
});
