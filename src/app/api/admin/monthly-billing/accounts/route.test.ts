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

vi.mock("@/features/monthly-billing/server/customerBillingAccountReadModel", () => ({
  loadMonthlyBillingAccountsOverview: vi.fn(),
  loadCustomerBillingAccountList: vi.fn(),
}));

describe("GET /api/admin/monthly-billing/accounts", () => {
  it("returns 401 for non-admin", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    vi.mocked(requireApiUser).mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Sign in required.",
      status: 401,
    });

    const response = await GET(new Request("http://localhost/api/admin/monthly-billing/accounts"));
    expect(response.status).toBe(401);
  });

  it("returns accounts overview for admin", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    const { loadMonthlyBillingAccountsOverview, loadCustomerBillingAccountList } = await import(
      "@/features/monthly-billing/server/customerBillingAccountReadModel"
    );

    vi.mocked(requireApiUser).mockResolvedValueOnce({
      id: "admin-1",
      role: "admin",
    } as never);

    vi.mocked(loadMonthlyBillingAccountsOverview).mockResolvedValueOnce({
      totalAccounts: 0,
      monthlyAccountsEnabled: 0,
      monthlyAccountsDisabled: 0,
      accountsNeedingZohoLink: 0,
      draftBatches: 0,
      generatedBatches: 0,
      sentBatches: 0,
      paidBatches: 0,
      overdueBatches: 0,
      outstandingAmountCents: 0,
      draftMonthlyAccountBookings: 0,
    });
    vi.mocked(loadCustomerBillingAccountList).mockResolvedValueOnce([]);

    const response = await GET(new Request("http://localhost/api/admin/monthly-billing/accounts"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.readOnly).toBe(true);
    expect(body.phase).toBe(1);
  });
});
