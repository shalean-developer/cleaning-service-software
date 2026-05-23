import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminProductionRolloutDashboard } from "./AdminProductionRolloutDashboard";

const adminAssistedDiagnosticsFixture = {
  generatedAt: "2026-05-23T10:00:00.000Z",
  readOnly: true as const,
  featureFlags: {
    bookingEnabled: true,
    paymentLinksEnabled: true,
    offlinePaymentsEnabled: false,
  },
  counts: {
    assistedDrafts: 0,
    pendingPayment: 0,
    awaitingPayment: 0,
    paymentLinksActive: 0,
    paymentLinksExpired: 0,
    stalePendingPayment: 0,
    offlinePaymentsRecorded: 0,
    offlinePaymentsFinalized: 0,
    offlinePaymentsFailed: 0,
    confirmedAfterAssistPayment: 0,
    failedPaymentRequestNotifications: 0,
    assignmentDispatchAttention: 0,
    confirmedWithoutAssignmentDispatch: 0,
  },
  alerts: [],
  rolloutStage: "payment_links" as const,
  analytics: {
    linksGenerated: 0,
    linksRegenerated: 0,
    emailsSent: 0,
    whatsappCopied: 0,
    expiredLinks: 0,
    paymentRequestsSentToday: 0,
    conversionRateGeneratedToPaid: null,
    averageDraftToPaidHours: null,
    averagePendingToConfirmedHours: null,
  },
  friction: {
    repeatedLinkRegenerations: 0,
    bookingsWithRepeatedRegenerate: 0,
    repeatedEmailResends: 0,
    bookingsWithRepeatedEmailResend: 0,
    longPendingPaymentBookings: 0,
    multipleFailedNotificationBookings: 0,
    offlinePaymentOverrides: 0,
    abandonedDrafts: 0,
    highOperatorActionBookings: 0,
    missingCustomerEmailBookings: 0,
    pilotDryRunBookings: 0,
  },
  operatorFeedbackCount: 0,
  scan: { bookingsScanned: 0, capped: false },
};

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
          adminAssistedDiagnostics: adminAssistedDiagnosticsFixture,
          adminAssistedReadiness: {
            rolloutStage: "payment_links",
            rolloutStageLabel: "Payment links enabled",
            rolloutStageDescription: "Paystack payment links enabled.",
            checklistProgress: { completed: 1, total: 13, percent: 8 },
            criticalProgress: { completed: 0, total: 11, percent: 0 },
            unresolvedBlockers: ["Draft flow tested"],
            productionReady: false,
            lastVerifiedAt: null,
            lastVerifiedBy: null,
          },
        }}
      />,
    );

    expect(html).toContain("Environment readiness");
    expect(html).toContain("admin-assisted-production-readiness-warning");
    expect(html).toContain("Admin-assisted rollout governance");
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
