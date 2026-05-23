import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as sendInvoicePost } from "./route";

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: vi.fn(),
  isApiAuthFailure: vi.fn(() => false),
}));

vi.mock("@/features/monthly-billing/server/monthlyInvoiceOperationsForAdmin", () => ({
  sendMonthlyInvoiceForAdmin: vi.fn(),
}));

const admin = { role: "admin", profileId: "admin-1" };

describe("POST /api/admin/monthly-billing/batches/[batchId]/send-invoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires confirmSend", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    vi.mocked(requireApiUser).mockResolvedValueOnce(admin as never);

    const response = await sendInvoicePost(
      new Request("http://localhost/api/admin/monthly-billing/batches/batch-1/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: "send-key-12345678" }),
      }),
      { params: Promise.resolve({ batchId: "00000000-0000-4000-8000-000000000001" }) },
    );

    expect(response.status).toBe(400);
  });
});
