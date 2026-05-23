import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminProductionRolloutDashboard } from "./AdminProductionRolloutDashboard";

describe("AdminProductionRolloutDashboard", () => {
  it("renders rollout sections, checklist, export, and no payment mutation actions", () => {
    const html = renderToStaticMarkup(
      <AdminProductionRolloutDashboard
        data={{
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
            oldestPendingAgeHours: 4,
          },
          rolloutReadiness: {
            safeForInvoicePayments: true,
            safeForSavedMethods: false,
            safeForSalesSync: false,
            safeForRefundSync: false,
            safeForAdminCharges: false,
          },
          recommendedNextSteps: ["Enable saved methods after live QA."],
          checklist: [
            {
              id: "1",
              checklistKey: "webhook_configured",
              label: "Paystack live webhook configured",
              category: "core_setup",
              completed: true,
              completedBy: null,
              completedAt: "2026-07-01T10:00:00.000Z",
              notes: null,
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
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
            warnings: ["Keep admin card charges disabled until reconciliation backlog is zero."],
          },
        }}
      />,
    );

    expect(html).toContain("Environment readiness");
    expect(html).toContain("Feature flag readiness");
    expect(html).toContain("Live QA checklist");
    expect(html).toContain("Emergency rollback");
    expect(html).toContain("Download CSV");
    expect(html).toContain("webhook_configured");
    expect(html).not.toContain("Mark paid");
    expect(html).not.toContain("Charge saved card");
    expect(html).not.toContain("authorization_code");
  });
});
