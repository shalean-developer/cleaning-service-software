import type { NotificationMetricsHourlyRow } from "./rollupNotificationMetricsHourly";

export const TRENDS_7D_HOURS = 24 * 7;
export const TRENDS_PRIOR_7D_HOURS = 24 * 7;
export const TRENDS_FULL_COVERAGE_HOURS = 24 * 7;
/** Show partial-coverage note below 90% of expected hourly buckets in the 7d window. */
export const TRENDS_PARTIAL_COVERAGE_THRESHOLD = Math.floor(TRENDS_FULL_COVERAGE_HOURS * 0.9);

export type NotificationMetricsHourlyBucket = Pick<
  NotificationMetricsHourlyRow,
  | "bucket_start"
  | "run_count"
  | "sent_count"
  | "failed_count"
  | "dry_run_count"
  | "live_sent_count"
  | "live_failed_count"
>;

export type AdminNotificationTrends7d = {
  sent7dTotal: number;
  sent7dPriorTotal: number;
  sent7dDeltaPercent: number | null;
  failed7dTotal: number;
  failed7dPriorTotal: number;
  failed7dDeltaPercent: number | null;
  liveSuccessRate7dPercent: number | null;
  liveSuccessRate7dPriorPercent: number | null;
  liveSuccessRate7dDeltaPoints: number | null;
  dryRun7dTotal: number;
  runCount7dTotal: number;
  runCount7dPriorTotal: number;
  runCount7dDeltaPercent: number | null;
  rollupAsOf: string | null;
  coverageHours7d: number;
  coverageComplete: boolean;
  partialCoverageNote: string | null;
  rollupStale: boolean;
};

function roundPercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function deltaPercent(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

function liveSuccessRatePercent(liveSent: number, liveFailed: number): number | null {
  return roundPercent(liveSent, liveSent + liveFailed);
}

function sumBuckets(
  buckets: NotificationMetricsHourlyBucket[],
  pick: (b: NotificationMetricsHourlyBucket) => number,
): number {
  return buckets.reduce((acc, b) => acc + pick(b), 0);
}

/** @internal Exported for tests. */
export function partitionMetricsBucketsByTrendWindow(
  buckets: NotificationMetricsHourlyBucket[],
  now: Date,
): {
  current7d: NotificationMetricsHourlyBucket[];
  prior7d: NotificationMetricsHourlyBucket[];
} {
  const currentStartMs = now.getTime() - TRENDS_7D_HOURS * 60 * 60_000;
  const priorStartMs = now.getTime() - (TRENDS_7D_HOURS + TRENDS_PRIOR_7D_HOURS) * 60 * 60_000;

  const current7d: NotificationMetricsHourlyBucket[] = [];
  const prior7d: NotificationMetricsHourlyBucket[] = [];

  for (const bucket of buckets) {
    const ms = Date.parse(bucket.bucket_start);
    if (!Number.isFinite(ms)) continue;
    if (ms > currentStartMs && ms <= now.getTime()) {
      current7d.push(bucket);
    } else if (ms > priorStartMs && ms <= currentStartMs) {
      prior7d.push(bucket);
    }
  }

  return { current7d, prior7d };
}

const EMPTY_TRENDS: AdminNotificationTrends7d = {
  sent7dTotal: 0,
  sent7dPriorTotal: 0,
  sent7dDeltaPercent: null,
  failed7dTotal: 0,
  failed7dPriorTotal: 0,
  failed7dDeltaPercent: null,
  liveSuccessRate7dPercent: null,
  liveSuccessRate7dPriorPercent: null,
  liveSuccessRate7dDeltaPoints: null,
  dryRun7dTotal: 0,
  runCount7dTotal: 0,
  runCount7dPriorTotal: 0,
  runCount7dDeltaPercent: null,
  rollupAsOf: null,
  coverageHours7d: 0,
  coverageComplete: false,
  partialCoverageNote:
    "No hourly rollup data yet — run the metrics rollup cron or backfill script.",
  rollupStale: false,
};

/** @internal Exported for tests. */
export function computeTrends7dFromHourlyBuckets(
  buckets: NotificationMetricsHourlyBucket[],
  now: Date = new Date(),
): AdminNotificationTrends7d {
  if (buckets.length === 0) {
    return { ...EMPTY_TRENDS };
  }

  const { current7d, prior7d } = partitionMetricsBucketsByTrendWindow(buckets, now);

  const sent7dTotal = sumBuckets(current7d, (b) => b.sent_count);
  const sent7dPriorTotal = sumBuckets(prior7d, (b) => b.sent_count);
  const failed7dTotal = sumBuckets(current7d, (b) => b.failed_count);
  const failed7dPriorTotal = sumBuckets(prior7d, (b) => b.failed_count);
  const dryRun7dTotal = sumBuckets(current7d, (b) => b.dry_run_count);
  const runCount7dTotal = sumBuckets(current7d, (b) => b.run_count);
  const runCount7dPriorTotal = sumBuckets(prior7d, (b) => b.run_count);

  const liveSent7d = sumBuckets(current7d, (b) => b.live_sent_count);
  const liveFailed7d = sumBuckets(current7d, (b) => b.live_failed_count);
  const liveSentPrior = sumBuckets(prior7d, (b) => b.live_sent_count);
  const liveFailedPrior = sumBuckets(prior7d, (b) => b.live_failed_count);

  const liveSuccessRate7dPercent = liveSuccessRatePercent(liveSent7d, liveFailed7d);
  const liveSuccessRate7dPriorPercent = liveSuccessRatePercent(liveSentPrior, liveFailedPrior);

  let liveSuccessRate7dDeltaPoints: number | null = null;
  if (liveSuccessRate7dPercent != null && liveSuccessRate7dPriorPercent != null) {
    liveSuccessRate7dDeltaPoints =
      Math.round((liveSuccessRate7dPercent - liveSuccessRate7dPriorPercent) * 10) / 10;
  }

  const rollupAsOf = buckets.reduce<string | null>((latest, b) => {
    if (!latest || b.bucket_start > latest) return b.bucket_start;
    return latest;
  }, null);

  const coverageHours7d = current7d.length;
  const coverageComplete = coverageHours7d >= TRENDS_PARTIAL_COVERAGE_THRESHOLD;

  let partialCoverageNote: string | null = null;
  if (!coverageComplete) {
    partialCoverageNote = `Trends based on ${coverageHours7d} of ${TRENDS_FULL_COVERAGE_HOURS} hourly buckets in the last 7 days — run backfill for a full week view.`;
  }

  const rollupStale =
    rollupAsOf != null &&
    now.getTime() - Date.parse(rollupAsOf) > 2 * 60 * 60_000;

  return {
    sent7dTotal,
    sent7dPriorTotal,
    sent7dDeltaPercent: deltaPercent(sent7dTotal, sent7dPriorTotal),
    failed7dTotal,
    failed7dPriorTotal,
    failed7dDeltaPercent: deltaPercent(failed7dTotal, failed7dPriorTotal),
    liveSuccessRate7dPercent,
    liveSuccessRate7dPriorPercent,
    liveSuccessRate7dDeltaPoints,
    dryRun7dTotal,
    runCount7dTotal,
    runCount7dPriorTotal,
    runCount7dDeltaPercent: deltaPercent(runCount7dTotal, runCount7dPriorTotal),
    rollupAsOf,
    coverageHours7d,
    coverageComplete,
    partialCoverageNote,
    rollupStale,
  };
}
