import { describe, expect, it } from "vitest";
import { productionRolloutSummaryToCsv } from "./productionRolloutExport";
import type { FeatureFlagRecommendations, ProductionRolloutStatus } from "./productionRolloutTypes";

function sampleStatus(): ProductionRolloutStatus {
  return {
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
      pendingReconciliationCount: 1,
      failedRefundSyncCount: 0,
      stalePendingCount: 0,
      failedZohoSyncCount: 0,
      failedAdminCharges: 0,
      oldestPendingAgeHours: 2,
    },
    rolloutReadiness: {
      safeForInvoicePayments: true,
      safeForSavedMethods: false,
      safeForSalesSync: false,
      safeForRefundSync: false,
      safeForAdminCharges: false,
    },
    recommendedNextSteps: ["Enable saved methods after QA."],
    checklist: [
      {
        id: "1",
        checklistKey: "webhook_configured",
        label: "Webhook configured",
        category: "core_setup",
        completed: true,
        completedBy: null,
        completedAt: "2026-07-01T10:00:00.000Z",
        notes: "Verified",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ],
  };
}

describe("productionRolloutExport", () => {
  it("exports safe CSV without secrets", () => {
    const recommendations: FeatureFlagRecommendations = {
      currentFlags: sampleStatus().featureFlags,
      recommendedChanges: [],
      warnings: [],
    };
    const csv = productionRolloutSummaryToCsv({
      status: sampleStatus(),
      featureFlagRecommendations: recommendations,
    });
    expect(csv).toContain("webhook_configured");
    expect(csv).toContain("safeForInvoicePayments");
    expect(csv).not.toContain("authorization_code");
    expect(csv).not.toContain("sk_live_");
    expect(csv).not.toContain("@");
  });
});
