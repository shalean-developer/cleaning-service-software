import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

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

vi.mock("@/features/bookings/server/admin/loadAdminAssistedProductionStatus", () => ({
  loadAdminAssistedProductionStatus: vi.fn(),
}));

describe("GET /api/admin/bookings/assist-production/weekly-export", () => {
  it("returns 401 for non-admin", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    vi.mocked(requireApiUser).mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Sign in required.",
      status: 401,
    });

    const response = await GET(
      new Request("http://localhost/api/admin/bookings/assist-production/weekly-export"),
    );
    expect(response.status).toBe(401);
  });
});
