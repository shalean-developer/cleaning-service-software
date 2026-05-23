import { describe, expect, it, vi, beforeEach } from "vitest";
import { isZohoRefundCreditSyncEnabled, requireZohoRefundCreditSyncEnabled } from "./zohoRefundCreditSyncLaunchGuard";

describe("zohoRefundCreditSyncLaunchGuard", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.ZOHO_REFUND_CREDIT_SYNC_ENABLED;
  });

  it("defaults ZOHO_REFUND_CREDIT_SYNC_ENABLED to false", () => {
    expect(isZohoRefundCreditSyncEnabled()).toBe(false);
    expect(requireZohoRefundCreditSyncEnabled().ok).toBe(false);
  });

  it("enables when flag is true and Zoho is configured", () => {
    vi.stubEnv("ZOHO_REFUND_CREDIT_SYNC_ENABLED", "true");
    vi.stubEnv("ZOHO_BOOKS_ENABLED", "true");
    vi.stubEnv("ZOHO_BOOKS_ORGANIZATION_ID", "org-1");
    vi.stubEnv("ZOHO_CLIENT_ID", "client");
    vi.stubEnv("ZOHO_CLIENT_SECRET", "secret");
    vi.stubEnv("ZOHO_REFRESH_TOKEN", "refresh-token-long-enough-for-config-check-1234567890");

    expect(isZohoRefundCreditSyncEnabled()).toBe(true);
    expect(requireZohoRefundCreditSyncEnabled().ok).toBe(true);
  });
});
