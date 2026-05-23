import { describe, expect, it, vi, beforeEach } from "vitest";
import { isZohoSalesSyncEnabled, requireZohoSalesSyncEnabled } from "./zohoSalesSyncLaunchGuard";

describe("zohoSalesSyncLaunchGuard", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults ZOHO_SALES_SYNC_ENABLED to false", () => {
    expect(isZohoSalesSyncEnabled()).toBe(false);
    expect(requireZohoSalesSyncEnabled().ok).toBe(false);
  });

  it("enables when flag is true and Zoho is configured", () => {
    vi.stubEnv("ZOHO_SALES_SYNC_ENABLED", "true");
    vi.stubEnv("ZOHO_BOOKS_ENABLED", "true");
    vi.stubEnv("ZOHO_BOOKS_ORGANIZATION_ID", "org-1");
    vi.stubEnv("ZOHO_CLIENT_ID", "client");
    vi.stubEnv("ZOHO_CLIENT_SECRET", "secret");
    vi.stubEnv("ZOHO_REFRESH_TOKEN", "refresh-token-long-enough-for-config-check-1234567890");

    expect(isZohoSalesSyncEnabled()).toBe(true);
    expect(requireZohoSalesSyncEnabled().ok).toBe(true);
  });

  it("blocks when flag is off", () => {
    vi.stubEnv("ZOHO_SALES_SYNC_ENABLED", "false");
    const gate = requireZohoSalesSyncEnabled();
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.code).toBe("SALES_SYNC_DISABLED");
    }
  });
});
