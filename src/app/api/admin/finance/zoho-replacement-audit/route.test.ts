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

vi.mock("@/features/zoho-replacement-audit/server/zohoReplacementAuditReadModel", () => ({
  loadZohoReplacementAudit: vi.fn(),
}));

describe("GET /api/admin/finance/zoho-replacement-audit", () => {
  it("returns 401 for non-admin", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    vi.mocked(requireApiUser).mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Sign in required.",
      status: 401,
    });

    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  it("returns audit payload for admin without secrets", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    const { loadZohoReplacementAudit } = await import(
      "@/features/zoho-replacement-audit/server/zohoReplacementAuditReadModel"
    );

    vi.mocked(requireApiUser).mockResolvedValueOnce({
      id: "admin-1",
      role: "admin",
      email: "admin@example.com",
    });

    vi.mocked(loadZohoReplacementAudit).mockResolvedValueOnce({
      audit: {
        summary: {
          overallReadinessScore: 42,
          recommendedDecision: "hybrid",
          criticalMissingCapabilities: ["Immutable accounting ledger"],
          highRiskAreas: ["Tax reporting risk"],
          estimatedMigrationComplexity: "high",
        },
        currentZohoDependencies: {
          invoices: true,
          customerPayments: true,
          creditNotes: true,
          taxSupport: true,
          customerStatements: true,
          accountingExports: true,
          reconciliationSupport: true,
        },
        shaleanCapabilities: {
          bookingPayments: true,
          savedMethods: true,
          adminCharges: true,
          reconciliation: true,
          accountingClose: true,
          taxReports: true,
          corporateStatements: true,
          financeAnalytics: true,
          payoutTracking: true,
          auditLogs: true,
        },
        capabilityMatrix: [],
        missingCapabilities: [],
        migrationRisks: [],
        suggestedMigrationPhases: [],
        recommendedArchitecture: [],
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.audit.summary.recommendedDecision).toBe("hybrid");
    expect(JSON.stringify(body)).not.toContain("refresh_token");
    expect(JSON.stringify(body)).not.toContain("authorization_code");
  });
});
