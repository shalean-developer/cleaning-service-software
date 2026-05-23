import { describe, expect, it, vi } from "vitest";
import { testCurrentUser } from "@/test/fixtures";
import { POST } from "./route";

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: vi.fn(),
  isApiAuthFailure: vi.fn(
    (result: unknown) =>
      typeof result === "object" &&
      result !== null &&
      "status" in result &&
      (result as { status: number }).status >= 400,
  ),
}));

vi.mock("@/features/production-rollout/server/productionRolloutChecklistRepository", () => ({
  updateProductionRolloutChecklistItem: vi.fn(),
}));

describe("POST /api/admin/production-rollout/checklist/[key]", () => {
  it("rejects invalid checklist key", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    vi.mocked(requireApiUser).mockResolvedValueOnce(
      testCurrentUser({ profileId: "admin-1", authUser: { email: "admin@example.com" } }),
    );

    const response = await POST(
      new Request("http://localhost/api/admin/production-rollout/checklist/invalid_key", {
        method: "POST",
        body: JSON.stringify({ completed: true }),
      }),
      { params: Promise.resolve({ key: "invalid_key" }) },
    );

    expect(response.status).toBe(400);
  });

  it("updates checklist item for admin", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    const { updateProductionRolloutChecklistItem } = await import(
      "@/features/production-rollout/server/productionRolloutChecklistRepository"
    );

    vi.mocked(requireApiUser).mockResolvedValueOnce(
      testCurrentUser({ profileId: "admin-1", authUser: { email: "admin@example.com" } }),
    );

    vi.mocked(updateProductionRolloutChecklistItem).mockResolvedValueOnce({
      id: "1",
      checklistKey: "webhook_configured",
      label: "Paystack live webhook configured",
      category: "core_setup",
      completed: true,
      completedBy: "admin-1",
      completedAt: "2026-07-01T10:00:00.000Z",
      notes: "Done",
      createdAt: "2026-07-01T00:00:00.000Z",
    });

    const response = await POST(
      new Request("http://localhost/api/admin/production-rollout/checklist/webhook_configured", {
        method: "POST",
        body: JSON.stringify({ completed: true, notes: "Done" }),
      }),
      { params: Promise.resolve({ key: "webhook_configured" }) },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.item.completed).toBe(true);
    expect(updateProductionRolloutChecklistItem).toHaveBeenCalledWith({
      checklistKey: "webhook_configured",
      completed: true,
      notes: "Done",
      adminProfileId: "admin-1",
    });
  });
});
