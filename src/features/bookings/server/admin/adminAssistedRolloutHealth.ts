import type { AdminAssistedBookingAlert } from "./adminAssistedBookingAlerts";
import type { AdminAssistedBookingAnalytics } from "./adminAssistedBookingAnalytics";
import type { AdminAssistedBookingFrictionMetrics } from "./adminAssistedBookingFriction";
import type { AdminAssistedBookingAlertCounts } from "./adminAssistedBookingAlerts";
import type { AdminAssistedRolloutReadiness } from "./adminAssistedRolloutReadiness";

export type AdminAssistedRolloutHealthBand = "healthy" | "warning" | "degraded" | "critical";

export type AdminAssistedRolloutHealthFactor = {
  label: string;
  impact: number;
};

export type AdminAssistedRolloutHealth = {
  score: number;
  band: AdminAssistedRolloutHealthBand;
  factors: AdminAssistedRolloutHealthFactor[];
  operatorAttentionSummary: string;
};

const SEVERITY_PENALTY: Record<AdminAssistedBookingAlert["severity"], number> = {
  critical: 18,
  high: 12,
  warning: 7,
  info: 2,
};

function bandFromScore(score: number): AdminAssistedRolloutHealthBand {
  if (score >= 85) return "healthy";
  if (score >= 70) return "warning";
  if (score >= 50) return "degraded";
  return "critical";
}

export function computeAdminAssistedRolloutHealth(input: {
  alerts: AdminAssistedBookingAlert[];
  counts: AdminAssistedBookingAlertCounts;
  analytics: AdminAssistedBookingAnalytics;
  friction: AdminAssistedBookingFrictionMetrics;
  readiness?: Pick<
    AdminAssistedRolloutReadiness,
    "unresolvedBlockers" | "productionReady" | "criticalProgress"
  >;
}): AdminAssistedRolloutHealth {
  const { alerts, counts, analytics, friction, readiness } = input;
  const factors: AdminAssistedRolloutHealthFactor[] = [];
  let score = 100;

  for (const alert of alerts) {
    const penalty = Math.min(SEVERITY_PENALTY[alert.severity], 25);
    const weighted = Math.min(penalty + Math.min(alert.count, 5) * 2, 30);
    score -= weighted;
    factors.push({ label: alert.title, impact: weighted });
  }

  if (readiness && !readiness.productionReady && readiness.unresolvedBlockers.length > 0) {
    const blockerPenalty = Math.min(readiness.unresolvedBlockers.length * 3, 15);
    score -= blockerPenalty;
    factors.push({
      label: `${readiness.unresolvedBlockers.length} unresolved checklist blocker(s)`,
      impact: blockerPenalty,
    });
  }

  if (friction.multipleFailedNotificationBookings > 0) {
    const penalty = Math.min(friction.multipleFailedNotificationBookings * 4, 12);
    score -= penalty;
    factors.push({
      label: "Bookings with failed notification delivery",
      impact: penalty,
    });
  }

  if (
    analytics.conversionRateGeneratedToPaid != null &&
    analytics.linksGenerated >= 5 &&
    analytics.conversionRateGeneratedToPaid < 0.25
  ) {
    score -= 8;
    factors.push({ label: "Low link-to-paid conversion", impact: 8 });
  }

  if (counts.offlinePaymentsFailed > 0) {
    const penalty = Math.min(counts.offlinePaymentsFailed * 5, 15);
    score -= penalty;
    factors.push({ label: "Offline payment failures", impact: penalty });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band = bandFromScore(score);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const highCount = alerts.filter((a) => a.severity === "high").length;

  let operatorAttentionSummary: string;
  if (band === "healthy") {
    operatorAttentionSummary = "Fleet metrics are within expected production thresholds.";
  } else if (criticalCount > 0) {
    operatorAttentionSummary = `${criticalCount} critical alert(s) require immediate operator attention.`;
  } else if (highCount > 0) {
    operatorAttentionSummary = `${highCount} high-priority item(s) — review assignment and payment flows today.`;
  } else if (counts.stalePendingPayment > 0) {
    operatorAttentionSummary = `${counts.stalePendingPayment} stale pending payment(s) need customer follow-up.`;
  } else {
    operatorAttentionSummary = "Review warning-level alerts and checklist blockers before expanding rollout.";
  }

  return {
    score,
    band,
    factors: factors.sort((a, b) => b.impact - a.impact).slice(0, 8),
    operatorAttentionSummary,
  };
}

export function countAlertsBySeverity(
  alerts: AdminAssistedBookingAlert[],
): Record<AdminAssistedBookingAlert["severity"], number> {
  return alerts.reduce(
    (acc, alert) => {
      acc[alert.severity] += alert.count > 0 ? alert.count : 1;
      return acc;
    },
    { critical: 0, high: 0, warning: 0, info: 0 },
  );
}
