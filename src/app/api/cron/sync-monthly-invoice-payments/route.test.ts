import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/cron/verifyCronSecret", () => ({
  verifyCronSecret: vi.fn(() => true),
}));

vi.mock("@/lib/app/zohoMonthlyInvoicePaymentSyncFlag", () => ({
  isZohoMonthlyInvoicePaymentSyncEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: vi.fn(() => ({})),
}));

vi.mock("@/features/monthly-billing/server/syncZohoMonthlyInvoicePaymentStatus", () => ({
  syncMonthlyInvoicePaymentsForCron: vi.fn(),
}));

describe("POST /api/cron/sync-monthly-invoice-payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires cron auth", async () => {
    const { verifyCronSecret } = await import("@/lib/cron/verifyCronSecret");
    vi.mocked(verifyCronSecret).mockReturnValueOnce(false);

    const response = await POST(new Request("http://localhost/api/cron/sync-monthly-invoice-payments"));
    expect(response.status).toBe(401);
  });

  it("returns summary when sync succeeds", async () => {
    const { syncMonthlyInvoicePaymentsForCron } = await import(
      "@/features/monthly-billing/server/syncZohoMonthlyInvoicePaymentStatus"
    );
    vi.mocked(syncMonthlyInvoicePaymentsForCron).mockResolvedValueOnce({
      checked: 3,
      paid: 1,
      overdue: 0,
      void: 0,
      failed: 0,
      unchanged: 2,
    });

    const response = await POST(
      new Request("http://localhost/api/cron/sync-monthly-invoice-payments?limit=10"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.checked).toBe(3);
    expect(json.paid).toBe(1);
  });
});
