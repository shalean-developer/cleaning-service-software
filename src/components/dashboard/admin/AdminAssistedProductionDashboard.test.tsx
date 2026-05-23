import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminAssistedProductionDashboard } from "./AdminAssistedProductionDashboard";
import type { AdminAssistedProductionStatus } from "@/features/bookings/server/admin/loadAdminAssistedProductionStatus";

function statusFixture(): AdminAssistedProductionStatus {
  return {
    generatedAt: "2026-05-23T10:00:00.000Z",
    readOnly: true,
    diagnostics: {
      generatedAt: "2026-05-23T10:00:00.000Z",
      readOnly: true,
      featureFlags: { bookingEnabled: true, paymentLinksEnabled: true, offlinePaymentsEnabled: false },
      counts: {
        assistedDrafts: 1,
        pendingPayment: 2,
        awaitingPayment: 1,
        paymentLinksActive: 1,
        paymentLinksExpired: 0,
        stalePendingPayment: 1,
        offlinePaymentsRecorded: 0,
        offlinePaymentsFinalized: 0,
        offlinePaymentsFailed: 0,
        confirmedAfterAssistPayment: 3,
        failedPaymentRequestNotifications: 0,
        assignmentDispatchAttention: 0,
        confirmedWithoutAssignmentDispatch: 0,
      },
      alerts: [],
      rolloutStage: "payment_links",
      analytics: {
        linksGenerated: 5,
        linksRegenerated: 0,
        emailsSent: 4,
        whatsappCopied: 1,
        expiredLinks: 0,
        paymentRequestsSentToday: 1,
        conversionRateGeneratedToPaid: 0.5,
        averageDraftToPaidHours: 10,
        averagePendingToConfirmedHours: 5,
      },
      friction: {
        repeatedLinkRegenerations: 0,
        bookingsWithRepeatedRegenerate: 0,
        repeatedEmailResends: 0,
        bookingsWithRepeatedEmailResend: 0,
        longPendingPaymentBookings: 1,
        multipleFailedNotificationBookings: 0,
        offlinePaymentOverrides: 0,
        abandonedDrafts: 0,
        highOperatorActionBookings: 0,
        missingCustomerEmailBookings: 0,
        pilotDryRunBookings: 0,
      },
      operatorFeedbackCount: 0,
      scan: { bookingsScanned: 10, capped: false },
    },
    readiness: {
      rolloutStage: "payment_links",
      rolloutStageLabel: "Payment links enabled",
      rolloutStageDescription: "Links on",
      checklistProgress: { completed: 8, total: 13, percent: 62 },
      criticalProgress: { completed: 8, total: 11, percent: 73 },
      unresolvedBlockers: ["Offline EFT tested"],
      productionReady: false,
      lastVerifiedAt: null,
      lastVerifiedBy: null,
    },
    health: {
      score: 88,
      band: "healthy",
      factors: [],
      operatorAttentionSummary: "Fleet metrics are within expected production thresholds.",
    },
    liveMetrics: {
      activeAssistedBookings: 5,
      pendingPayments: 2,
      confirmedToday: 1,
      offlineEftToday: 0,
      failedPaymentRequests: 0,
      recurringMaterializationFailures: 0,
      orphanConfirmedBookings: 0,
      assignmentDispatchFailures: 0,
      stalePendingOver72h: 1,
    },
    alertCountsBySeverity: { critical: 0, high: 0, warning: 0, info: 0 },
    activeIncidents: [],
    unresolvedAlerts: [],
    recentPaymentConfirmations: [],
    recentRecurringMaterializations: [],
    recentOfflineRecordings: [],
    recentFailedNotifications: [],
    recentAssignmentEscalations: [],
    observability: {
      assistSummaryCacheHits: 10,
      assistSummaryCacheMisses: 2,
      assistSummaryCacheHitRate: 83.3,
      productionLoadDurationMs: 120,
      exportGenerationDurationMs: null,
      recurringEnrichmentDurationMs: 45,
    },
  };
}

import type { AdminAssistedProductionLearning } from "@/features/bookings/server/admin/loadAdminAssistedProductionLearning";

function learningFixture(status: AdminAssistedProductionStatus): AdminAssistedProductionLearning {
  return {
    generatedAt: status.generatedAt,
    readOnly: true,
    production: status,
    incidentsWithReview: [],
    unresolvedIncidentCount: 0,
    operatorLessons: [],
    weeklyReview: {
      generatedAt: status.generatedAt,
      periodLabel: "Rolling 7-day operational window",
      healthScore: status.health.score,
      healthBand: status.health.band,
      healthScoreTrend: "stable",
      bookingsCreated: 4,
      conversionRate: 0.5,
      paymentSuccessRate: 0.5,
      assignmentSuccessRate: 1,
      recurringSuccessRate: 1,
      failedNotifications: 0,
      unresolvedIncidents: 0,
      operatorFeedbackHighlights: [],
      recommendedDecision: {
        decision: "continue_pilot",
        label: "Continue current rollout stage",
        rationale: "Stable",
        advisoryOnly: true,
      },
    },
    improvementBacklog: [],
    rolloutDecision: {
      decision: "continue_pilot",
      label: "Continue current rollout stage",
      rationale: "Stable",
      advisoryOnly: true,
    },
  };
}

describe("AdminAssistedProductionDashboard", () => {
  it("renders production observability and learning sections", () => {
    const status = statusFixture();
    const html = renderToStaticMarkup(
      <AdminAssistedProductionDashboard status={status} learning={learningFixture(status)} />,
    );
    expect(html).toContain("admin-assisted-production-dashboard");
    expect(html).toContain("admin-assisted-rollout-health");
    expect(html).toContain("admin-assisted-live-metrics");
    expect(html).toContain("admin-assisted-production-learning");
    expect(html).toContain("admin-assisted-weekly-export-csv");
    expect(html).not.toContain("sk_live_");
  });
});
