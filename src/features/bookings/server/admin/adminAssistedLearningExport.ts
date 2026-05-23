import "server-only";

import { formatCsvRow } from "@/features/dashboards/server/adminBookingsExport";
import type { AdminAssistedImprovementBacklogItem } from "./adminAssistedImprovementBacklog";
import type { AdminAssistedIncidentWithReview } from "./adminAssistedIncidentReviewTypes";
import type { AdminAssistedOperatorLesson } from "./adminAssistedOperatorLessonTypes";
import type { AdminAssistedWeeklyRolloutReview } from "./adminAssistedWeeklyRolloutReview";

const FORBIDDEN = ["sk_live_", "sk_test_", "authorization_code", "access_code", "paystack.com/"] as const;

export function assertSafeLearningExport(content: string): void {
  const lower = content.toLowerCase();
  for (const token of FORBIDDEN) {
    if (lower.includes(token.toLowerCase())) {
      throw new Error(`Export contains forbidden content: ${token}`);
    }
  }
}

export function incidentReviewsToJson(incidents: AdminAssistedIncidentWithReview[]): Record<string, unknown> {
  return {
    ok: true,
    incidents: incidents.map((item) => ({
      incidentKey: item.id,
      bookingId: item.bookingId,
      category: item.category,
      severity: item.severity,
      title: item.title,
      reviewStatus: item.reviewStatus,
      ownerProfileId: item.review?.ownerProfileId ?? null,
      rootCauseNotes: item.review?.rootCauseNotes ?? null,
      resolutionNotes: item.review?.resolutionNotes ?? null,
      followUpAction: item.review?.followUpAction ?? null,
      reviewedAt: item.review?.reviewedAt ?? null,
    })),
  };
}

export function incidentReviewsToCsv(incidents: AdminAssistedIncidentWithReview[]): string {
  const headers = [
    "incident_key",
    "booking_id",
    "category",
    "severity",
    "title",
    "review_status",
    "root_cause_notes",
    "resolution_notes",
    "follow_up_action",
    "reviewed_at",
  ];
  const rows = incidents.map((item) =>
    formatCsvRow([
      item.id,
      item.bookingId,
      item.category,
      item.severity,
      item.title,
      item.reviewStatus,
      item.review?.rootCauseNotes ?? "",
      item.review?.resolutionNotes ?? "",
      item.review?.followUpAction ?? "",
      item.review?.reviewedAt ?? "",
    ]),
  );
  const csv = [formatCsvRow(headers), ...rows].join("\n");
  assertSafeLearningExport(csv);
  return csv;
}

export function operatorLessonsToJson(lessons: AdminAssistedOperatorLesson[]): Record<string, unknown> {
  return { ok: true, lessons };
}

export function operatorLessonsToCsv(lessons: AdminAssistedOperatorLesson[]): string {
  const headers = ["lesson_id", "booking_id", "category", "tags", "summary", "detail", "created_at"];
  const rows = lessons.map((lesson) =>
    formatCsvRow([
      lesson.id,
      lesson.bookingId,
      lesson.category ?? "",
      lesson.tags.join("|"),
      lesson.summary,
      lesson.detail ?? "",
      lesson.createdAt,
    ]),
  );
  const csv = [formatCsvRow(headers), ...rows].join("\n");
  assertSafeLearningExport(csv);
  return csv;
}

export function improvementBacklogToJson(items: AdminAssistedImprovementBacklogItem[]): Record<string, unknown> {
  return { ok: true, backlog: items };
}

export function improvementBacklogToCsv(items: AdminAssistedImprovementBacklogItem[]): string {
  const headers = [
    "id",
    "title",
    "source",
    "severity",
    "frequency",
    "suggested_owner",
    "recommended_action",
    "status",
  ];
  const rows = items.map((item) =>
    formatCsvRow([
      item.id,
      item.title,
      item.source,
      item.severity,
      String(item.frequency),
      item.suggestedOwner,
      item.recommendedAction,
      item.status,
    ]),
  );
  const csv = [formatCsvRow(headers), ...rows].join("\n");
  assertSafeLearningExport(csv);
  return csv;
}

export function weeklyReviewToJson(review: AdminAssistedWeeklyRolloutReview): Record<string, unknown> {
  return { ok: true, review };
}

export function weeklyReviewToCsv(review: AdminAssistedWeeklyRolloutReview): string {
  const headers = ["metric", "value"];
  const rows: [string, string][] = [
    ["health_score", String(review.healthScore)],
    ["health_band", review.healthBand],
    ["health_score_trend", review.healthScoreTrend],
    ["bookings_created", String(review.bookingsCreated)],
    ["conversion_rate", review.conversionRate == null ? "" : String(review.conversionRate)],
    ["payment_success_rate", review.paymentSuccessRate == null ? "" : String(review.paymentSuccessRate)],
    ["assignment_success_rate", review.assignmentSuccessRate == null ? "" : String(review.assignmentSuccessRate)],
    ["recurring_success_rate", review.recurringSuccessRate == null ? "" : String(review.recurringSuccessRate)],
    ["failed_notifications", String(review.failedNotifications)],
    ["unresolved_incidents", String(review.unresolvedIncidents)],
    ["recommended_decision", review.recommendedDecision.decision],
    ["decision_rationale", review.recommendedDecision.rationale],
  ];
  const csv = [formatCsvRow(headers), ...rows.map(([metric, value]) => formatCsvRow([metric, value]))].join("\n");
  assertSafeLearningExport(csv);
  return csv;
}
