import { buildAssignmentPathTrends7d, type AssignmentPathTrends7d } from "./assignmentAnalyticsPathDto";
import type { AssignmentMetricsHourlyRow } from "./rollupAssignmentMetricsHourly";
import { sumAssignmentMetricsPathCounters } from "./assignmentAnalyticsPathMetrics";
import {
  computeAcceptRatePercent,
  computeRatePercent,
  computeTerminalOfferCount,
  sumAssignmentMetricsCounters,
  type AssignmentMetricsHourlyCounters,
  type AssignmentMetricsPathCounters,
} from "./assignmentMetricsAggregate";

export const TRENDS_7D_HOURS = 24 * 7;
export const TRENDS_PRIOR_7D_HOURS = 24 * 7;
export const TRENDS_FULL_COVERAGE_HOURS = 24 * 7;
export const TRENDS_PARTIAL_COVERAGE_THRESHOLD = Math.floor(TRENDS_FULL_COVERAGE_HOURS * 0.9);

export type AssignmentMetricsHourlyBucket = Pick<
  AssignmentMetricsHourlyRow,
  | "bucket_start"
  | "offers_created_count"
  | "offers_accepted_count"
  | "offers_declined_count"
  | "offers_expired_count"
  | "offers_cancelled_count"
  | "bookings_assigned_count"
  | "redispatch_booking_count"
  | "max_attempts_booking_count"
  | "admin_intervention_count"
  | "offers_created_selected_count"
  | "offers_created_best_available_count"
  | "offers_created_admin_manual_count"
  | "offers_created_unknown_count"
  | "offers_accepted_selected_count"
  | "offers_accepted_best_available_count"
  | "offers_accepted_admin_manual_count"
  | "offers_accepted_unknown_count"
  | "time_to_assigned_bucket_0_15m_count"
  | "time_to_assigned_bucket_15_60m_count"
  | "time_to_assigned_bucket_1_4h_count"
  | "time_to_assigned_bucket_4_12h_count"
  | "time_to_assigned_bucket_12_24h_count"
  | "time_to_assigned_bucket_24_48h_count"
  | "time_to_assigned_bucket_48h_plus_count"
  | "time_to_assigned_sample_count"
  | "cleaner_response_bucket_0_15m_count"
  | "cleaner_response_bucket_15_60m_count"
  | "cleaner_response_bucket_1_4h_count"
  | "cleaner_response_bucket_4_12h_count"
  | "cleaner_response_bucket_12_24h_count"
  | "cleaner_response_bucket_24_48h_count"
  | "cleaner_response_bucket_48h_plus_count"
  | "cleaner_response_sample_count"
  | "time_to_first_offer_bucket_0_15m_count"
  | "time_to_first_offer_bucket_15_60m_count"
  | "time_to_first_offer_bucket_1_4h_count"
  | "time_to_first_offer_bucket_4_12h_count"
  | "time_to_first_offer_bucket_12_24h_count"
  | "time_to_first_offer_bucket_24_48h_count"
  | "time_to_first_offer_bucket_48h_plus_count"
  | "time_to_first_offer_sample_count"
>;

export type AdminAssignmentTrends7d = {
  offersCreated7d: number;
  offersCreated7dPrior: number;
  offersCreated7dDeltaPercent: number | null;
  acceptRate7dPercent: number | null;
  acceptRate7dPriorPercent: number | null;
  acceptRate7dDeltaPoints: number | null;
  bookingsAssigned7d: number;
  redispatchBookings7d: number;
  maxAttemptsBookings7d: number;
  byPath7d: AssignmentPathTrends7d;
  rollupAsOf: string | null;
  coverageHours7d: number;
  coverageComplete: boolean;
  partialCoverageNote: string | null;
};

function deltaPercent(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

export function partitionAssignmentBucketsByTrendWindow(
  buckets: AssignmentMetricsHourlyBucket[],
  now: Date,
): {
  current7d: AssignmentMetricsHourlyBucket[];
  prior7d: AssignmentMetricsHourlyBucket[];
} {
  const currentStartMs = now.getTime() - TRENDS_7D_HOURS * 60 * 60_000;
  const priorStartMs = now.getTime() - (TRENDS_7D_HOURS + TRENDS_PRIOR_7D_HOURS) * 60 * 60_000;

  const current7d: AssignmentMetricsHourlyBucket[] = [];
  const prior7d: AssignmentMetricsHourlyBucket[] = [];

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

export function buildAssignmentTrends7d(
  buckets: AssignmentMetricsHourlyBucket[],
  now: Date = new Date(),
): AdminAssignmentTrends7d {
  const { current7d, prior7d } = partitionAssignmentBucketsByTrendWindow(buckets, now);
  const current = sumAssignmentMetricsCounters(current7d);
  const prior = sumAssignmentMetricsCounters(prior7d);
  const currentPath = sumPathCountersFromBuckets(current7d);

  const rollupAsOf =
    current7d.length > 0
      ? current7d.reduce((latest, b) =>
          Date.parse(b.bucket_start) > Date.parse(latest.bucket_start) ? b : latest,
        ).bucket_start
      : null;

  const coverageHours7d = current7d.length;
  const coverageComplete = coverageHours7d >= TRENDS_PARTIAL_COVERAGE_THRESHOLD;
  const partialCoverageNote = coverageComplete
    ? null
    : `7-day trends use ${coverageHours7d} of ${TRENDS_FULL_COVERAGE_HOURS} expected hourly buckets. run the rollup cron or backfill.`;

  return {
    offersCreated7d: current.offers_created_count,
    offersCreated7dPrior: prior.offers_created_count,
    offersCreated7dDeltaPercent: deltaPercent(
      current.offers_created_count,
      prior.offers_created_count,
    ),
    acceptRate7dPercent: computeAcceptRatePercent(current),
    acceptRate7dPriorPercent: computeAcceptRatePercent(prior),
    acceptRate7dDeltaPoints:
      computeAcceptRatePercent(current) != null && computeAcceptRatePercent(prior) != null
        ? Math.round(
            ((computeAcceptRatePercent(current) ?? 0) - (computeAcceptRatePercent(prior) ?? 0)) *
              10,
          ) / 10
        : null,
    bookingsAssigned7d: current.bookings_assigned_count,
    redispatchBookings7d: current.redispatch_booking_count,
    maxAttemptsBookings7d: current.max_attempts_booking_count,
    byPath7d: buildAssignmentPathTrends7d(currentPath),
    rollupAsOf,
    coverageHours7d,
    coverageComplete,
    partialCoverageNote,
  };
}

export function countersFromBucket(bucket: AssignmentMetricsHourlyBucket): AssignmentMetricsHourlyCounters {
  return {
    offers_created_count: bucket.offers_created_count,
    offers_accepted_count: bucket.offers_accepted_count,
    offers_declined_count: bucket.offers_declined_count,
    offers_expired_count: bucket.offers_expired_count,
    offers_cancelled_count: bucket.offers_cancelled_count,
    bookings_assigned_count: bucket.bookings_assigned_count,
    redispatch_booking_count: bucket.redispatch_booking_count,
    max_attempts_booking_count: bucket.max_attempts_booking_count,
    admin_intervention_count: bucket.admin_intervention_count,
  };
}

export function pathCountersFromBucket(
  bucket: AssignmentMetricsHourlyBucket,
): AssignmentMetricsPathCounters {
  return {
    offers_created_selected_count: bucket.offers_created_selected_count ?? 0,
    offers_created_best_available_count: bucket.offers_created_best_available_count ?? 0,
    offers_created_admin_manual_count: bucket.offers_created_admin_manual_count ?? 0,
    offers_created_unknown_count: bucket.offers_created_unknown_count ?? 0,
    offers_accepted_selected_count: bucket.offers_accepted_selected_count ?? 0,
    offers_accepted_best_available_count: bucket.offers_accepted_best_available_count ?? 0,
    offers_accepted_admin_manual_count: bucket.offers_accepted_admin_manual_count ?? 0,
    offers_accepted_unknown_count: bucket.offers_accepted_unknown_count ?? 0,
  };
}

export function sumPathCountersFromBuckets(
  buckets: readonly AssignmentMetricsHourlyBucket[],
): AssignmentMetricsPathCounters {
  return sumAssignmentMetricsPathCounters(buckets.map(pathCountersFromBucket));
}

export { computeAcceptRatePercent, computeRatePercent, computeTerminalOfferCount };
