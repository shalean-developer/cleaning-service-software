import type { NotificationHealthSummary } from "./notificationAdminTypes";

export const NOTIFICATION_ANALYTICS_WINDOW_HOURS = 24;

export type WorkerRunAnalyticsInput = {
  ok: boolean;
  delivery_enabled: boolean;
  email_provider: string | null;
  reclaimed: number;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  dry_run: number;
};

export type NotificationWorker24hAnalytics = {
  windowHours: typeof NOTIFICATION_ANALYTICS_WINDOW_HOURS;
  runCount: number;
  runsOkPercent: number | null;
  sentTotal: number;
  failedTotal: number;
  dryRunTotal: number;
  scannedTotal: number;
  skippedTotal: number;
  reclaimedTotal: number;
  avgSentPerRun: number | null;
  avgScannedPerRun: number | null;
  /** Live Resend deliveries only. excludes dry-run provider runs. */
  liveSuccessRatePercent: number | null;
  dryRunRatioPercent: number | null;
};

export type NotificationQueuePressureLevel = "normal" | "elevated" | "critical";

export type NotificationQueuePressure = {
  score: number;
  level: NotificationQueuePressureLevel;
  label: string;
};

function roundPercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** @internal Exported for tests. */
export function computeWorker24hAnalytics(
  runs: WorkerRunAnalyticsInput[],
): NotificationWorker24hAnalytics {
  const runCount = runs.length;
  let okCount = 0;
  let sentTotal = 0;
  let failedTotal = 0;
  let dryRunTotal = 0;
  let scannedTotal = 0;
  let skippedTotal = 0;
  let reclaimedTotal = 0;
  let liveSent = 0;
  let liveFailed = 0;

  for (const run of runs) {
    if (run.ok) okCount += 1;
    sentTotal += run.sent;
    failedTotal += run.failed;
    dryRunTotal += run.dry_run;
    scannedTotal += run.scanned;
    skippedTotal += run.skipped;
    reclaimedTotal += run.reclaimed;

    if (run.delivery_enabled && run.email_provider === "resend") {
      liveSent += run.sent;
      liveFailed += run.failed;
    }
  }

  const deliveryDenominator = sentTotal + failedTotal + dryRunTotal;

  return {
    windowHours: NOTIFICATION_ANALYTICS_WINDOW_HOURS,
    runCount,
    runsOkPercent: roundPercent(okCount, runCount),
    sentTotal,
    failedTotal,
    dryRunTotal,
    scannedTotal,
    skippedTotal,
    reclaimedTotal,
    avgSentPerRun: runCount > 0 ? Math.round((sentTotal / runCount) * 10) / 10 : null,
    avgScannedPerRun: runCount > 0 ? Math.round((scannedTotal / runCount) * 10) / 10 : null,
    liveSuccessRatePercent: roundPercent(liveSent, liveSent + liveFailed),
    dryRunRatioPercent: roundPercent(dryRunTotal, deliveryDenominator),
  };
}

/** @internal Exported for tests. */
export function computeQueuePressure(
  summary: Pick<
    NotificationHealthSummary,
    "actionablePending" | "processing" | "failed" | "staleProcessing"
  >,
): NotificationQueuePressure {
  const score = summary.actionablePending + summary.processing + summary.failed;

  if (summary.failed >= 5 || summary.staleProcessing >= 1) {
    return { score, level: "critical", label: "Critical queue pressure" };
  }
  if (summary.actionablePending >= 10 || summary.processing >= 5) {
    return { score, level: "elevated", label: "Elevated queue pressure" };
  }
  return { score, level: "normal", label: "Normal queue pressure" };
}
