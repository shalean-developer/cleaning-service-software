import "server-only";

import { formatCsvRow } from "@/features/dashboards/server/adminBookingsExport";
import type { AdminAssistedProductionStatus } from "./loadAdminAssistedProductionStatus";
import { recordExportGenerationDuration } from "./adminAssistedProductionObservability";

const FORBIDDEN_CSV_SUBSTRINGS = ["sk_live_", "sk_test_", "authorization_code", "access_code"] as const;

function assertSafeCsv(csv: string): void {
  const lower = csv.toLowerCase();
  for (const forbidden of FORBIDDEN_CSV_SUBSTRINGS) {
    if (lower.includes(forbidden.toLowerCase())) {
      throw new Error(`Export contains forbidden field: ${forbidden}`);
    }
  }
}

export function buildAdminAssistedWeeklyExportFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `admin-assisted-weekly-${stamp}.csv`;
}

export function adminAssistedWeeklyProductionToJson(
  status: AdminAssistedProductionStatus,
): Record<string, unknown> {
  const { diagnostics, health, liveMetrics, readiness } = status;
  const { analytics, friction, counts } = diagnostics;

  return {
    ok: true,
    generatedAt: status.generatedAt,
    period: "rolling_7d_scan_window",
    rolloutStage: diagnostics.rolloutStage,
    healthScore: health.score,
    healthBand: health.band,
    metrics: {
      bookingsCreated: counts.assistedDrafts + counts.pendingPayment + counts.confirmedAfterAssistPayment,
      conversionRate: analytics.conversionRateGeneratedToPaid,
      paymentSuccessRate:
        analytics.linksGenerated > 0
          ? analytics.conversionRateGeneratedToPaid
          : counts.confirmedAfterAssistPayment > 0
            ? 1
            : null,
      averageDraftToPaidHours: analytics.averageDraftToPaidHours,
      averagePendingToConfirmedHours: analytics.averagePendingToConfirmedHours,
      assignmentSuccessRate:
        counts.confirmedAfterAssistPayment > 0
          ? 1 -
            (counts.assignmentDispatchAttention + counts.confirmedWithoutAssignmentDispatch) /
              counts.confirmedAfterAssistPayment
          : null,
      recurringSuccessRate:
        liveMetrics.recurringMaterializationFailures === 0
          ? 1
          : Math.max(
              0,
              1 -
                liveMetrics.recurringMaterializationFailures /
                  Math.max(counts.confirmedAfterAssistPayment, 1),
            ),
      offlineEftUsage: counts.offlinePaymentsFinalized,
      offlineEftToday: liveMetrics.offlineEftToday,
      alertCountsBySeverity: status.alertCountsBySeverity,
      operatorFeedbackCount: diagnostics.operatorFeedbackCount,
      unresolvedIncidents: status.activeIncidents.length,
      productionReady: readiness.productionReady,
      checklistProgress: readiness.checklistProgress,
    },
    friction,
    alerts: status.unresolvedAlerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      title: a.title,
      count: a.count,
    })),
    incidents: status.activeIncidents.map((i) => ({
      id: i.id,
      category: i.category,
      severity: i.severity,
      bookingId: i.bookingId,
      title: i.title,
    })),
    observability: status.observability,
  };
}

export function adminAssistedWeeklyProductionToCsv(status: AdminAssistedProductionStatus): string {
  const started = Date.now();
  const json = adminAssistedWeeklyProductionToJson(status);
  const metrics = json.metrics as Record<string, unknown>;

  const headers = [
    "metric",
    "value",
    "generated_at",
  ];

  const rows: [string, string][] = [
    ["rollout_stage", String(json.rolloutStage)],
    ["health_score", String(json.healthScore)],
    ["health_band", String(json.healthBand)],
    ["bookings_created", String(metrics.bookingsCreated)],
    ["conversion_rate", metrics.conversionRate == null ? "" : String(metrics.conversionRate)],
    ["payment_success_rate", metrics.paymentSuccessRate == null ? "" : String(metrics.paymentSuccessRate)],
    ["avg_draft_to_paid_hours", metrics.averageDraftToPaidHours == null ? "" : String(metrics.averageDraftToPaidHours)],
    ["assignment_success_rate", metrics.assignmentSuccessRate == null ? "" : String(metrics.assignmentSuccessRate)],
    ["recurring_success_rate", metrics.recurringSuccessRate == null ? "" : String(metrics.recurringSuccessRate)],
    ["offline_eft_usage", String(metrics.offlineEftUsage)],
    ["offline_eft_today", String(metrics.offlineEftToday)],
    ["alerts_critical", String((metrics.alertCountsBySeverity as Record<string, number>).critical)],
    ["alerts_high", String((metrics.alertCountsBySeverity as Record<string, number>).high)],
    ["alerts_warning", String((metrics.alertCountsBySeverity as Record<string, number>).warning)],
    ["alerts_info", String((metrics.alertCountsBySeverity as Record<string, number>).info)],
    ["operator_feedback_count", String(metrics.operatorFeedbackCount)],
    ["unresolved_incidents", String(metrics.unresolvedIncidents)],
    ["production_ready", String(metrics.productionReady)],
    ["checklist_percent", String((metrics.checklistProgress as { percent: number }).percent)],
  ];

  const csv = [
    formatCsvRow(headers),
    ...rows.map(([metric, value]) => formatCsvRow([metric, value, status.generatedAt])),
  ].join("\n");

  assertSafeCsv(csv);
  recordExportGenerationDuration(Date.now() - started);
  return csv;
}
