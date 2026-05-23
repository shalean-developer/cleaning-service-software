import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const requireApiUserMock = vi.fn();
const isApiAuthFailureMock = vi.fn();
const loadAccountingCloseMock = vi.fn();
const parseAccountingCloseQueryParamsMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (...args: unknown[]) => isApiAuthFailureMock(...args),
}));

vi.mock("@/features/accounting-close/server/accountingCloseReadModel", () => ({
  loadAccountingClose: (...args: unknown[]) => loadAccountingCloseMock(...args),
}));

vi.mock("@/features/accounting-close/server/parseAccountingCloseQueryParams", () => ({
  parseAccountingCloseQueryParams: (...args: unknown[]) =>
    parseAccountingCloseQueryParamsMock(...args),
}));

describe("GET /api/admin/finance/accounting-close", () => {
  it("returns 401 for non-admin", async () => {
    requireApiUserMock.mockResolvedValue({ error: "UNAUTHORIZED", message: "Admin only", status: 401 });
    isApiAuthFailureMock.mockReturnValue(true);

    const response = await GET(new Request("http://localhost/api/admin/finance/accounting-close"));
    expect(response.status).toBe(401);
  });

  it("returns summary and items for admin", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    isApiAuthFailureMock.mockReturnValue(false);
    parseAccountingCloseQueryParamsMock.mockReturnValue({
      periodType: "monthly",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.999Z",
      source: "all",
    });
    loadAccountingCloseMock.mockResolvedValue({
      summary: {
        periodStart: "2026-07-01T00:00:00.000Z",
        periodEnd: "2026-07-31T23:59:59.999Z",
        grossSalesCents: 5000,
        refundsCreditsCents: 0,
        netSalesCents: 5000,
        matchedAmountCents: 5000,
        pendingAmountCents: 0,
        mismatchAmountCents: 0,
        failedAmountCents: 0,
        totalTransactions: 1,
        paidTransactions: 1,
        failedTransactions: 0,
        refundCreditCount: 0,
        unresolvedCount: 0,
        readyToClose: true,
        blockingIssues: [],
      },
      items: [
        {
          id: "booking:pay-1",
          source: "booking",
          reference: "pay-ref-1",
          invoiceNumber: "INV-001",
          bookingId: "booking-1",
          amountCents: 5000,
          currency: "ZAR",
          signedAmountCents: 5000,
          status: "matched",
          reconciliationStatus: "matched",
          issueCode: "MATCHED",
          createdAt: "2026-07-01T10:00:00.000Z",
          paidAt: "2026-07-01T10:05:00.000Z",
          syncedAt: "2026-07-01T10:05:00.000Z",
        },
      ],
    });

    const response = await GET(new Request("http://localhost/api/admin/finance/accounting-close"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary.readyToClose).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("authorization_code");
  });
});
