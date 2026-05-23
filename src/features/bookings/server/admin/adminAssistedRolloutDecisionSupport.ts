import type { AdminAssistedProductionStatus } from "./loadAdminAssistedProductionStatus";
import type { AdminAssistedIncidentWithReview } from "./adminAssistedIncidentReviewTypes";

export type AdminAssistedRolloutDecision =
  | "continue_pilot"
  | "expand_payment_links"
  | "enable_eft"
  | "hold_rollout"
  | "rollback";

export type AdminAssistedRolloutDecisionRecommendation = {
  decision: AdminAssistedRolloutDecision;
  label: string;
  rationale: string;
  advisoryOnly: true;
};

export function computeAdminAssistedRolloutDecision(input: {
  status: AdminAssistedProductionStatus;
  incidentsWithReview: AdminAssistedIncidentWithReview[];
  unresolvedIncidentCount: number;
}): AdminAssistedRolloutDecisionRecommendation {
  const { status, incidentsWithReview, unresolvedIncidentCount } = input;
  const { health, diagnostics, liveMetrics } = status;
  const { counts, analytics } = diagnostics;

  const criticalIncidents = incidentsWithReview.filter(
    (i) =>
      i.severity === "critical" &&
      i.reviewStatus !== "resolved" &&
      i.reviewStatus !== "dismissed",
  ).length;

  const assignmentSuccessRate =
    counts.confirmedAfterAssistPayment > 0
      ? 1 -
        (counts.assignmentDispatchAttention + counts.confirmedWithoutAssignmentDispatch) /
          counts.confirmedAfterAssistPayment
      : 1;

  const paymentSuccessRate =
    analytics.linksGenerated > 0
      ? (analytics.conversionRateGeneratedToPaid ?? 0)
      : counts.confirmedAfterAssistPayment > 0
        ? 1
        : 0;

  const holdSignals =
    criticalIncidents > 0 ||
    liveMetrics.recurringMaterializationFailures > 0 ||
    counts.offlinePaymentsFailed > 0 ||
    counts.failedPaymentRequestNotifications >= 3 ||
    health.band === "critical";

  if (holdSignals) {
    return {
      decision: health.band === "critical" ? "rollback" : "hold_rollout",
      label: health.band === "critical" ? "Consider rollback" : "Hold rollout",
      rationale:
        "Critical incidents, recurring failures, offline anomalies, or elevated failed payment requests detected.",
      advisoryOnly: true,
    };
  }

  const expandReady =
    health.score >= 85 &&
    unresolvedIncidentCount <= 2 &&
    assignmentSuccessRate >= 0.9 &&
    paymentSuccessRate >= 0.5 &&
    diagnostics.rolloutStage === "payment_links";

  if (expandReady && status.readiness.productionReady) {
    return {
      decision: "enable_eft",
      label: "Enable EFT (next stage)",
      rationale:
        "Health score is strong, incidents are low, and checklist indicates production readiness for offline EFT.",
      advisoryOnly: true,
    };
  }

  if (
    health.score >= 85 &&
    unresolvedIncidentCount <= 2 &&
    assignmentSuccessRate >= 0.85 &&
    diagnostics.rolloutStage === "draft_only"
  ) {
    return {
      decision: "expand_payment_links",
      label: "Expand to payment links",
      rationale: "Draft/pending flow is stable — payment links may be expanded per checklist.",
      advisoryOnly: true,
    };
  }

  if (health.score >= 70) {
    return {
      decision: "continue_pilot",
      label: "Continue current rollout stage",
      rationale: "Metrics are acceptable but not yet strong enough for the next stage.",
      advisoryOnly: true,
    };
  }

  return {
    decision: "hold_rollout",
    label: "Hold rollout",
    rationale: "Health score or success rates need improvement before expanding.",
    advisoryOnly: true,
  };
}
