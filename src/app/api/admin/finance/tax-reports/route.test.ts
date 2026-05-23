import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const requireApiUserMock = vi.fn();
const isApiAuthFailureMock = vi.fn();
const loadTaxReportMock = vi.fn();
const parseTaxReportQueryParamsMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (...args: unknown[]) => isApiAuthFailureMock(...args),
}));

vi.mock("@/features/tax-reports/server/taxReportReadModel", () => ({
  loadTaxReport: (...args: unknown[]) => loadTaxReportMock(...args),
}));

vi.mock("@/features/tax-reports/server/parseTaxReportQueryParams", () => ({
  parseTaxReportQueryParams: (...args: unknown[]) => parseTaxReportQueryParamsMock(...args),
}));

describe("GET /api/admin/finance/tax-reports", () => {
  it("returns 401 for non-admin", async () => {
    requireApiUserMock.mockResolvedValue({ error: "UNAUTHORIZED", message: "Admin only", status: 401 });
    isApiAuthFailureMock.mockReturnValue(true);

    const response = await GET(new Request("http://localhost/api/admin/finance/tax-reports"));
    expect(response.status).toBe(401);
  });

  it("returns summary and items for admin", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    isApiAuthFailureMock.mockReturnValue(false);
    parseTaxReportQueryParamsMock.mockReturnValue({
      periodType: "monthly",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.999Z",
      source: "all",
      includeUnresolved: false,
    });
    loadTaxReportMock.mockResolvedValue({
      summary: {
        periodStart: "2026-07-01T00:00:00.000Z",
        periodEnd: "2026-07-31T23:59:59.999Z",
        vatRegistered: false,
        vatRate: 15,
        grossSalesCents: 11500,
        refundsCreditsCents: 0,
        netSalesAfterCreditsCents: 11500,
        estimatedOutputVatCents: 0,
        netExcludingVatCents: 11500,
        transactionCount: 1,
        refundCreditCount: 0,
      },
      items: [],
      sourceBreakdown: [],
      includesUnresolved: false,
      hasUnresolvedWarning: false,
    });

    const response = await GET(new Request("http://localhost/api/admin/finance/tax-reports"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary.vatRegistered).toBe(false);
    expect(JSON.stringify(body)).not.toContain("authorization_code");
  });
});
