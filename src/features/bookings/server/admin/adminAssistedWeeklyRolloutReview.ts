import type { AdminAssistedProductionStatus } from "./loadAdminAssistedProductionStatus";
import type { AdminAssistedIncidentWithReview } from "./adminAssistedIncidentReviewTypes";
import type { AdminAssistedOperatorLesson } from "./adminAssistedOperatorLessonTypes";
import {
  computeAdminAssistedRolloutDecision,
  type AdminAssistedRolloutDecisionRecommendation,
} from "./adminAssistedRolloutDecisionSupport";

export type AdminAssistedWeeklyRolloutReview = {
  generatedAt: string;
  periodLabel: string;
  healthScore: number;
  healthBand: AdminAssistedProductionStatus["health"]["band"];
  healthScoreTrend: "stable" | "improving" | "declining";
  bookingsCreated: number;
  conversionRate: number | null;
  paymentSuccessRate: number | null;
  assignmentSuccessRate: number | null;
  recurringSuccessRate: number | null;
  failedNotifications: number;
  unresolvedIncidents: number;
  operatorFeedbackHighlights: string[];
  recommendedDecision: AdminAssistedRolloutDecisionRecommendation;
};

export function buildAdminAssistedWeeklyRolloutReview(input: {
  status: AdminAssistedProductionStatus;
  incidentsWithReview: AdminAssistedIncidentWithReview[];
  unresolvedIncidentCount: number;
  operatorFeedbackHighlights: string[];
  priorHealthScore?: number | null;
}): AdminAssistedWeeklyRolloutReview {
  const { status, incidentsWithReview, unresolvedIncidentCount, operatorFeedbackHighlights } =
    input;
  const { diagnostics, health, liveMetrics } = status;
  const { analytics, counts } = diagnostics;

  const assignmentSuccessRate =
    counts.confirmedAfterAssistPayment > 0
      ? 1 -
        (counts.assignmentDispatchAttention + counts.confirmedWithoutAssignmentDispatch) /
          counts.confirmedAfterAssistPayment
      : null;

  const paymentSuccessRate =
    analytics.linksGenerated > 0
      ? analytics.conversionRateGeneratedToPaid
      : counts.confirmedAfterAssistPayment > 0
        ? 1
        : null;

  const recurringSuccessRate =
    liveMetrics.recurringMaterializationFailures === 0
      ? 1
      : counts.confirmedAfterAssistPayment > 0
        ? Math.max(
            0,
            1 - liveMetrics.recurringMaterializationFailures / counts.confirmedAfterAssistPayment,
          )
        : null;

  let healthScoreTrend: AdminAssistedWeeklyRolloutReview["healthScoreTrend"] = "stable";
  if (input.priorHealthScore != null) {
    if (health.score > input.priorHealthScore + 3) healthScoreTrend = "improving";
    else if (health.score < input.priorHealthScore - 3) healthScoreTrend = "declining";
  } else if (health.band === "healthy") {
    healthScoreTrend = "improving";
  } else if (health.band === "critical" || health.band === "degraded") {
    healthScoreTrend = "declining";
  }

  return {
    generatedAt: status.generatedAt,
    periodLabel: "Rolling 7-day operational window",
    healthScore: health.score,
    healthBand: health.band,
    healthScoreTrend,
    bookingsCreated:
      counts.assistedDrafts + counts.pendingPayment + counts.confirmedAfterAssistPayment,
    conversionRate: analytics.conversionRateGeneratedToPaid,
    paymentSuccessRate,
    assignmentSuccessRate,
    recurringSuccessRate,
    failedNotifications: counts.failedPaymentRequestNotifications,
    unresolvedIncidents: unresolvedIncidentCount,
    operatorFeedbackHighlights,
    recommendedDecision: computeAdminAssistedRolloutDecision({
      status,
      incidentsWithReview,
      unresolvedIncidentCount,
    }),
  };
}
