import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/sync-zoho-refunds-credits/route";

const verifyCronSecretMock = vi.fn();
const retryMock = vi.fn();

vi.mock("@/lib/cron/verifyCronSecret", () => ({
  verifyCronSecret: (...args: unknown[]) => verifyCronSecretMock(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({}),
}));

vi.mock("@/features/zoho-sales-sync/server/retryZohoRefundCreditSync", () => ({
  retryZohoRefundCreditSync: (...args: unknown[]) => retryMock(...args),
}));

describe("GET /api/cron/sync-zoho-refunds-credits", () => {
  it("rejects missing cron secret", async () => {
    verifyCronSecretMock.mockReturnValue(false);
    const response = await GET(new Request("http://localhost"));
    expect(response.status).toBe(401);
  });

  it("returns safe summary on success", async () => {
    verifyCronSecretMock.mockReturnValue(true);
    retryMock.mockResolvedValue({
      attempted: 2,
      synced: 1,
      failed: 1,
      skipped: 0,
    });

    const response = await GET(new Request("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.attempted).toBe(2);
    expect(body).not.toHaveProperty("authorization_code");
  });
});
