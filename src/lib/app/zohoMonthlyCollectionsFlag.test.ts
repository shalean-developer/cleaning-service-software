import { afterEach, describe, expect, it, vi } from "vitest";
import { isZohoMonthlyCollectionsEnabled } from "./zohoMonthlyCollectionsFlag";

describe("isZohoMonthlyCollectionsEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_COLLECTIONS_ENABLED", undefined);
    expect(isZohoMonthlyCollectionsEnabled()).toBe(false);
  });

  it.each(["true", "1", "yes"])("is active when billing and collections flags enabled (%s)", (value) => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", value);
    vi.stubEnv("ZOHO_MONTHLY_COLLECTIONS_ENABLED", value);
    expect(isZohoMonthlyCollectionsEnabled()).toBe(true);
  });
});
