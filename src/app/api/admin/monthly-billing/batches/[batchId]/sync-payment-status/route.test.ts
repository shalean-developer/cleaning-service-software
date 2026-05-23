import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: vi.fn(),
  isApiAuthFailure: vi.fn(() => false),
}));

vi.mock("@/features/monthly-billing/server/syncMonthlyInvoicePaymentStatusForAdmin", () => ({
  syncMonthlyInvoicePaymentStatusForAdmin: vi.fn(),
}));

const admin = { role: "admin", profileId: "admin-1" };

describe("POST /api/admin/monthly-billing/batches/[batchId]/sync-payment-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires confirmSync", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    vi.mocked(requireApiUser).mockResolvedValueOnce(admin as never);

    const response = await POST(
      new Request("http://localhost/api/admin/monthly-billing/batches/batch-1/sync-payment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: "sync-key-12345678" }),
      }),
      { params: Promise.resolve({ batchId: "00000000-0000-4000-8000-000000000001" }) },
    );

    expect(response.status).toBe(400);
  });

  it("returns sync result for valid admin request", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    const { syncMonthlyInvoicePaymentStatusForAdmin } = await import(
      "@/features/monthly-billing/server/syncMonthlyInvoicePaymentStatusForAdmin"
    );
    vi.mocked(requireApiUser).mockResolvedValueOnce(admin as never);
    vi.mocked(syncMonthlyInvoicePaymentStatusForAdmin).mockResolvedValueOnce({
      ok: true,
      outcome: "synced",
      sync: {
        batchId: "00000000-0000-4000-8000-000000000001",
        previousStatus: "generated",
        currentStatus: "paid",
        source: "manual",
        paidAt: "2026-05-23T12:00:00.000Z",
        itemCount: 2,
        changed: true,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/admin/monthly-billing/batches/batch-1/sync-payment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: "sync-key-12345678",
          confirmSync: true,
        }),
      }),
      { params: Promise.resolve({ batchId: "00000000-0000-4000-8000-000000000001" }) },
    );

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.sync.currentStatus).toBe("paid");
  });
});
