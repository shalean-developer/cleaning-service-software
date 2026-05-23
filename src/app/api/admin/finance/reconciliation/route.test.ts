import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/finance/reconciliation/route";

const authMock = vi.fn();
const loadMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => authMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "status" in user,
}));

vi.mock("@/features/finance-reconciliation/server/parseFinanceReconciliationQueryParams", () => ({
  parseFinanceReconciliationQueryParams: () => ({
    source: "booking",
    status: "matched",
    limit: 10,
  }),
}));

vi.mock("@/features/finance-reconciliation/server/financeReconciliationReadModel", () => ({
  loadFinanceReconciliation: (...args: unknown[]) => loadMock(...args),
}));

describe("GET /api/admin/finance/reconciliation", () => {
  it("requires admin", async () => {
    authMock.mockResolvedValue({ status: 401, error: "UNAUTHORIZED", message: "Denied" });
    const response = await GET(new Request("http://localhost/api/admin/finance/reconciliation"));
    expect(response.status).toBe(401);
  });

  it("returns safe reconciliation payload", async () => {
    authMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    loadMock.mockResolvedValue({
      summary: {
        matchedCount: 1,
        pendingCount: 0,
        mismatchCount: 0,
        failedCount: 0,
        totalAmountCents: 1000,
        matchedAmountCents: 1000,
        pendingAmountCents: 0,
        mismatchAmountCents: 0,
        failedAmountCents: 0,
        bookingSalesSyncedCount: 1,
        manualInvoicePaymentsReconciledCount: 0,
        savedCardChargesReconciledCount: 0,
        refundsCreditsSyncedCount: 0,
        oldestPendingAt: null,
        latestFailedAt: null,
      },
      items: [],
      nextCursor: null,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/finance/reconciliation?source=booking&status=matched&limit=10",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary.matchedCount).toBe(1);
    expect(body).not.toHaveProperty("authorization_code");
  });
});
