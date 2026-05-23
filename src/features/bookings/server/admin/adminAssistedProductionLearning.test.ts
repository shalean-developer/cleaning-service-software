import { describe, expect, it } from "vitest";
import {
  countUnresolvedIncidentReviews,
  mergeIncidentsWithReviews,
} from "./adminAssistedIncidentReviewRepository";
import type { AdminAssistedIncidentReviewRecord } from "./adminAssistedIncidentReviewTypes";
import { generateAdminAssistedImprovementBacklog } from "./adminAssistedImprovementBacklog";
import {
  assertSafeLearningExport,
  incidentReviewsToCsv,
  operatorLessonsToCsv,
  weeklyReviewToCsv,
} from "./adminAssistedLearningExport";
import {
  deriveOperatorLessonsFromFeedback,
  summarizeLessonTags,
} from "./adminAssistedOperatorLessons";
import { computeAdminAssistedRolloutDecision } from "./adminAssistedRolloutDecisionSupport";
import { buildAdminAssistedWeeklyRolloutReview } from "./adminAssistedWeeklyRolloutReview";
import type { AdminAssistedProductionStatus } from "./loadAdminAssistedProductionStatus";

function productionFixture(
  overrides: Partial<AdminAssistedProductionStatus> = {},
): AdminAssistedProductionStatus {
  return {
    generatedAt: "2026-05-23T10:00:00.000Z",
    readOnly: true,
    diagnostics: {
      generatedAt: "2026-05-23T10:00:00.000Z",
      readOnly: true,
      featureFlags: { bookingEnabled: true, paymentLinksEnabled: true, offlinePaymentsEnabled: false },
      counts: {
        assistedDrafts: 1,
        pendingPayment: 1,
        awaitingPayment: 0,
        paymentLinksActive: 1,
        paymentLinksExpired: 0,
        stalePendingPayment: 0,
        offlinePaymentsRecorded: 0,
        offlinePaymentsFinalized: 0,
        offlinePaymentsFailed: 0,
        confirmedAfterAssistPayment: 4,
        failedPaymentRequestNotifications: 0,
        assignmentDispatchAttention: 0,
        confirmedWithoutAssignmentDispatch: 0,
      },
      alerts: [],
      rolloutStage: "payment_links",
      analytics: {
        linksGenerated: 8,
        linksRegenerated: 0,
        emailsSent: 6,
        whatsappCopied: 0,
        expiredLinks: 0,
        paymentRequestsSentToday: 1,
        conversionRateGeneratedToPaid: 0.75,
        averageDraftToPaidHours: 8,
        averagePendingToConfirmedHours: 4,
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
      operatorFeedbackCount: 2,
      scan: { bookingsScanned: 20, capped: false },
    },
    readiness: {
      rolloutStage: "payment_links",
      rolloutStageLabel: "Payment links",
      rolloutStageDescription: "Links enabled",
      checklistProgress: { completed: 10, total: 13, percent: 77 },
      criticalProgress: { completed: 10, total: 11, percent: 91 },
      unresolvedBlockers: [],
      productionReady: true,
      lastVerifiedAt: "2026-05-22T10:00:00.000Z",
      lastVerifiedBy: "admin-1",
    },
    health: {
      score: 90,
      band: "healthy",
      factors: [],
      operatorAttentionSummary: "Stable",
    },
    liveMetrics: {
      activeAssistedBookings: 3,
      pendingPayments: 1,
      confirmedToday: 1,
      offlineEftToday: 0,
      failedPaymentRequests: 0,
      recurringMaterializationFailures: 0,
      orphanConfirmedBookings: 0,
      assignmentDispatchFailures: 0,
      stalePendingOver72h: 0,
    },
    alertCountsBySeverity: { critical: 0, high: 0, warning: 0, info: 0 },
    activeIncidents: [
      {
        id: "link_regeneration_loop:b1",
        bookingId: "b1",
        customerLabel: "Jane",
        category: "link_regeneration_loop",
        severity: "warning",
        title: "Repeated link regeneration",
        guidance: "Review",
        escalation: "Ops lead",
        occurrenceCount: 2,
      },
    ],
    unresolvedAlerts: [],
    recentPaymentConfirmations: [],
    recentRecurringMaterializations: [],
    recentOfflineRecordings: [],
    recentFailedNotifications: [],
    recentAssignmentEscalations: [],
    observability: {
      assistSummaryCacheHits: 5,
      assistSummaryCacheMisses: 1,
      assistSummaryCacheHitRate: 83.3,
      productionLoadDurationMs: 100,
      exportGenerationDurationMs: null,
      recurringEnrichmentDurationMs: 30,
    },
    ...overrides,
  };
}

describe("adminAssistedProductionLearning", () => {
  it("merges incident reviews and counts unresolved", () => {
    const reviews: AdminAssistedIncidentReviewRecord[] = [
      {
        id: "r1",
        incidentKey: "link_regeneration_loop:b1",
        bookingId: "b1",
        category: "link_regeneration_loop",
        status: "investigating",
        severity: "warning",
        ownerProfileId: "admin-1",
        rootCauseNotes: "Customer confusion",
        resolutionNotes: null,
        followUpAction: null,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: "2026-05-23T09:00:00.000Z",
        updatedAt: "2026-05-23T09:00:00.000Z",
      },
    ];

    const merged = mergeIncidentsWithReviews(productionFixture().activeIncidents, reviews);
    expect(merged[0]?.reviewStatus).toBe("investigating");
    expect(countUnresolvedIncidentReviews(merged)).toBe(1);
  });

  it("defaults incident review status to open when no record exists", () => {
    const merged = mergeIncidentsWithReviews(productionFixture().activeIncidents, []);
    expect(merged[0]?.reviewStatus).toBe("open");
  });

  it("builds weekly rollout review metrics", () => {
    const status = productionFixture();
    const review = buildAdminAssistedWeeklyRolloutReview({
      status,
      incidentsWithReview: mergeIncidentsWithReviews(status.activeIncidents, []),
      unresolvedIncidentCount: 1,
      operatorFeedbackHighlights: ["Payment link step unclear"],
    });

    expect(review.healthScore).toBe(90);
    expect(review.bookingsCreated).toBe(6);
    expect(review.conversionRate).toBe(0.75);
    expect(review.operatorFeedbackHighlights).toContain("Payment link step unclear");
    expect(review.recommendedDecision.advisoryOnly).toBe(true);
  });

  it("recommends enable EFT when health and readiness are strong", () => {
    const status = productionFixture();
    const decision = computeAdminAssistedRolloutDecision({
      status,
      incidentsWithReview: mergeIncidentsWithReviews(status.activeIncidents, []),
      unresolvedIncidentCount: 1,
    });

    expect(decision.decision).toBe("enable_eft");
    expect(decision.advisoryOnly).toBe(true);
  });

  it("recommends hold when critical incidents are open", () => {
    const status = productionFixture({
      activeIncidents: [
        {
          id: "assignment_escalation:b2",
          bookingId: "b2",
          customerLabel: "Bob",
          category: "assignment_escalation",
          severity: "critical",
          title: "Orphan confirmed",
          guidance: "Escalate",
          escalation: "Ops lead immediately",
          occurrenceCount: 1,
        },
      ],
      health: {
        score: 55,
        band: "degraded",
        factors: [],
        operatorAttentionSummary: "Degraded",
      },
    });

    const decision = computeAdminAssistedRolloutDecision({
      status,
      incidentsWithReview: mergeIncidentsWithReviews(status.activeIncidents, []),
      unresolvedIncidentCount: 1,
    });

    expect(["hold_rollout", "rollback"]).toContain(decision.decision);
  });

  it("derives operator lessons and aggregates tags", () => {
    const lessons = deriveOperatorLessonsFromFeedback([
      {
        id: "f1",
        bookingId: "b1",
        adminProfileId: "admin-1",
        confusingText: "Step 3 unclear",
        slowedDownText: null,
        paymentSucceeded: false,
        customerUnderstood: false,
        notes: "Customer asked about recurring",
        lessonCategory: "payment_issue",
        lessonTags: ["payment", "UX"],
        createdAt: "2026-05-23T08:00:00.000Z",
      },
    ]);

    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.tags).toContain("payment");
    const tags = summarizeLessonTags(lessons);
    expect(tags.find((t) => t.tag === "payment")?.count).toBe(1);
  });

  it("generates backlog from repeated tags and weekly hold decision", () => {
    const backlog = generateAdminAssistedImprovementBacklog({
      incidents: [],
      tagSummaries: [{ tag: "payment", count: 3 }],
      unresolvedAlerts: [],
      recommendedDecision: {
        decision: "hold_rollout",
        label: "Hold rollout",
        rationale: "Elevated failures",
        advisoryOnly: true,
      },
    });

    expect(backlog.some((item) => item.source === "feedback_tag")).toBe(true);
    expect(backlog.some((item) => item.source === "weekly_review")).toBe(true);
    expect(backlog.every((item) => item.status === "new")).toBe(true);
  });

  it("scrubs forbidden content from learning exports", () => {
    const status = productionFixture();
    const weekly = buildAdminAssistedWeeklyRolloutReview({
      status,
      incidentsWithReview: [],
      unresolvedIncidentCount: 0,
      operatorFeedbackHighlights: [],
    });
    const csv = weeklyReviewToCsv(weekly);
    expect(csv).toContain("health_score");
    expect(() => assertSafeLearningExport("token sk_live_secret")).toThrow();

    const incidentCsv = incidentReviewsToCsv([]);
    expect(incidentCsv).toContain("incident_key");
    const lessonsCsv = operatorLessonsToCsv([]);
    expect(lessonsCsv).toContain("lesson_id");
  });
});
