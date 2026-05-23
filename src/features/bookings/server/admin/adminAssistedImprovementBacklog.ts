import type { AdminAssistedBookingAlert } from "./adminAssistedBookingAlerts";
import type { AdminAssistedIncidentWithReview } from "./adminAssistedIncidentReviewTypes";
import type { AdminAssistedLessonTagSummary } from "./adminAssistedOperatorLessonTypes";

import type { AdminAssistedRolloutDecisionRecommendation } from "./adminAssistedRolloutDecisionSupport";

export type AdminAssistedBacklogStatus = "new" | "accepted" | "deferred" | "done";

export type AdminAssistedImprovementBacklogItem = {
  id: string;
  title: string;
  source: "incident" | "feedback_tag" | "alert" | "weekly_review";
  severity: "critical" | "high" | "warning" | "info";
  frequency: number;
  suggestedOwner: string;
  recommendedAction: string;
  status: AdminAssistedBacklogStatus;
};

export function generateAdminAssistedImprovementBacklog(input: {
  incidents: AdminAssistedIncidentWithReview[];
  tagSummaries: AdminAssistedLessonTagSummary[];
  unresolvedAlerts: AdminAssistedBookingAlert[];
  recommendedDecision?: AdminAssistedRolloutDecisionRecommendation;
}): AdminAssistedImprovementBacklogItem[] {
  const items: AdminAssistedImprovementBacklogItem[] = [];

  const incidentGroups = new Map<string, AdminAssistedIncidentWithReview[]>();
  for (const incident of input.incidents) {
    if (incident.reviewStatus === "resolved" || incident.reviewStatus === "dismissed") continue;
    const list = incidentGroups.get(incident.category) ?? [];
    list.push(incident);
    incidentGroups.set(incident.category, list);
  }

  for (const [category, group] of incidentGroups) {
    const maxSeverity = group.some((g) => g.severity === "critical")
      ? "critical"
      : group.some((g) => g.severity === "high")
        ? "high"
        : "warning";
    items.push({
      id: `incident:${category}`,
      title: `Repeated ${category.replace(/_/g, " ")} incidents`,
      source: "incident",
      severity: maxSeverity,
      frequency: group.length,
      suggestedOwner: "ops_lead",
      recommendedAction: group[0]?.escalation ?? "Review incident queue and document root cause.",
      status: "new",
    });
  }

  for (const tag of input.tagSummaries) {
    if (tag.count < 2) continue;
    items.push({
      id: `feedback_tag:${tag.tag}`,
      title: `Operator feedback theme: ${tag.tag}`,
      source: "feedback_tag",
      severity: tag.count >= 4 ? "high" : "warning",
      frequency: tag.count,
      suggestedOwner: tag.tag === "bug" ? "engineering" : "ops_lead",
      recommendedAction: `Review ${tag.count} operator lessons tagged ${tag.tag}.`,
      status: "new",
    });
  }

  for (const alert of input.unresolvedAlerts) {
    if (alert.severity === "info") continue;
    items.push({
      id: `alert:${alert.id}`,
      title: alert.title,
      source: "alert",
      severity: alert.severity,
      frequency: alert.count,
      suggestedOwner: alert.severity === "critical" ? "ops_lead" : "operator",
      recommendedAction: alert.escalation,
      status: "new",
    });
  }

  const decision = input.recommendedDecision;
  if (decision && (decision.decision === "hold_rollout" || decision.decision === "rollback")) {
    items.push({
      id: `weekly_review:${decision.decision}`,
      title: decision.label,
      source: "weekly_review",
      severity: decision.decision === "rollback" ? "critical" : "high",
      frequency: 1,
      suggestedOwner: "ops_lead",
      recommendedAction: decision.rationale,
      status: "new",
    });
  }

  const severityRank = (s: AdminAssistedImprovementBacklogItem["severity"]) =>
    s === "critical" ? 0 : s === "high" ? 1 : s === "warning" ? 2 : 3;

  return items.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.frequency - a.frequency);
}
