import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const requireApiUserMock = vi.fn();
const isApiAuthFailureMock = vi.fn();
const loadCorporateStatementMock = vi.fn();
const parseCorporateStatementQueryParamsMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (...args: unknown[]) => isApiAuthFailureMock(...args),
}));

vi.mock("@/features/corporate-statements/server/corporateStatementReadModel", () => ({
  loadCorporateStatement: (...args: unknown[]) => loadCorporateStatementMock(...args),
}));

vi.mock("@/features/corporate-statements/server/parseCorporateStatementQueryParams", () => ({
  CorporateStatementValidationError: class CorporateStatementValidationError extends Error {
    code = "VALIDATION_ERROR";
  },
  parseCorporateStatementQueryParams: (...args: unknown[]) =>
    parseCorporateStatementQueryParamsMock(...args),
}));

describe("GET /api/admin/finance/corporate-statements", () => {
  it("returns 401 for non-admin", async () => {
    requireApiUserMock.mockResolvedValue({ error: "UNAUTHORIZED", message: "Admin only", status: 401 });
    isApiAuthFailureMock.mockReturnValue(true);

    const response = await GET(
      new Request("http://localhost/api/admin/finance/corporate-statements?customerEmail=a@b.com"),
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 when customer identifier missing", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    isApiAuthFailureMock.mockReturnValue(false);
    const { CorporateStatementValidationError } = await import(
      "@/features/corporate-statements/server/parseCorporateStatementQueryParams"
    );
    parseCorporateStatementQueryParamsMock.mockImplementation(() => {
      throw new CorporateStatementValidationError("At least one customer identifier is required.");
    });

    const response = await GET(new Request("http://localhost/api/admin/finance/corporate-statements"));
    expect(response.status).toBe(400);
  });

  it("returns statement for admin", async () => {
    requireApiUserMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    isApiAuthFailureMock.mockReturnValue(false);
    parseCorporateStatementQueryParamsMock.mockReturnValue({
      customerEmail: "accounts@acme.com",
      periodType: "monthly",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.999Z",
    });
    loadCorporateStatementMock.mockResolvedValue({
      summary: {
        customerLabel: "Acme Corp",
        customerEmail: "accounts@acme.com",
        periodStart: "2026-07-01T00:00:00.000Z",
        periodEnd: "2026-07-31T23:59:59.999Z",
        openingBalanceCents: 0,
        invoiceChargesCents: 0,
        paymentsCents: 10000,
        refundsCreditsCents: 0,
        closingBalanceCents: 0,
        outstandingCount: 0,
        paidCount: 1,
      },
      items: [],
      openingBalanceNote: "Opening balance note",
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/finance/corporate-statements?customerEmail=accounts@acme.com",
      ),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary.customerLabel).toBe("Acme Corp");
    expect(JSON.stringify(body)).not.toContain("authorization_code");
  });
});
