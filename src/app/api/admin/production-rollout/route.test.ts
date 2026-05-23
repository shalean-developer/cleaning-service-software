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

vi.mock("@/features/production-rollout/server/productionRolloutReadModel", () => ({
  loadProductionRolloutStatus: vi.fn(),
}));

describe("GET /api/admin/production-rollout", () => {
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
  });

  it("returns rollout status for admin without secrets", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    const { loadProductionRolloutStatus } = await import(
      "@/features/production-rollout/server/productionRolloutReadModel"
    );

    vi.mocked(requireApiUser).mockResolvedValueOnce({
      id: "admin-1",
      role: "admin",
      email: "admin@example.com",
    });

    vi.mocked(loadProductionRolloutStatus).mockResolvedValueOnce({
      environment: {
        appBaseUrlConfigured: true,
        paystackConfigured: true,
        zohoConfigured: true,
        cronSecretConfigured: true,
        supabaseConfigured: true,
        liveModeDetected: true,
      },
      featureFlags: {
        invoicePaymentsEnabled: true,
        savedMethodsEnabled: false,
        adminCardChargesEnabled: false,
        salesSyncEnabled: false,
        refundCreditSyncEnabled: false,
        vatEnabled: false,
      },
      operationalHealth: {
        failedReconciliationCount: 0,
        pendingReconciliationCount: 0,
        failedRefundSyncCount: 0,
        stalePendingCount: 0,
        failedZohoSyncCount: 0,
        failedAdminCharges: 0,
        oldestPendingAgeHours: null,
      },
      rolloutReadiness: {
        safeForInvoicePayments: true,
        safeForSavedMethods: false,
        safeForSalesSync: false,
        safeForRefundSync: false,
        safeForAdminCharges: false,
      },
      recommendedNextSteps: ["QA saved methods"],
      checklist: [],
      adminAssistedDiagnostics: {
        generatedAt: new Date().toISOString(),
        readOnly: true,
        featureFlags: {
          bookingEnabled: false,
          paymentLinksEnabled: false,
          offlinePaymentsEnabled: false,
        },
        counts: {
          assistedDrafts: 0,
          pendingPayment: 0,
          paymentLinksActive: 0,
          paymentLinksExpired: 0,
          offlinePaymentsRecorded: 0,
          offlinePaymentsFinalized: 0,
          offlinePaymentsFailed: 0,
          confirmedAfterAssistPayment: 0,
          failedPaymentRequestNotifications: 0,
          assignmentDispatchAttention: 0,
        },
        scan: { bookingsScanned: 0, capped: false },
      },
      featureFlagRecommendations: {
        currentFlags: {
          invoicePaymentsEnabled: true,
          savedMethodsEnabled: false,
          adminCardChargesEnabled: false,
          salesSyncEnabled: false,
          refundCreditSyncEnabled: false,
          vatEnabled: false,
        },
        recommendedChanges: [],
        warnings: [],
      },
    });

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.rolloutReadiness.safeForInvoicePayments).toBe(true);
    expect(JSON.stringify(body)).not.toContain("authorization_code");
  });
});
