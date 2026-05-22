import type { AssignmentLatencyMetricStatus } from "./assignmentLatencyDto";
import {
  approximateMedianMinutesFromLatencyHistogram,
  mergeCleanerResponseHistogramCounts,
  mergeLatencyHistogramCounts,
  mergeTimeToFirstOfferHistogramCounts,
  type CleanerResponseHistogramCounts,
  type LatencyHistogramCounts,
  type LatencyHistogramMetricPrefix,
  type TimeToFirstOfferHistogramCounts,
  type TimeToAssignedHistogramCounts,
} from "./assignmentLatencyHistogram";
import { ASSIGNMENT_LATENCY_MIN_SAMPLE } from "./assignmentLatencyMetrics";
import {
  partitionAssignmentBucketsByTrendWindow,
  TRENDS_FULL_COVERAGE_HOURS,
  TRENDS_PARTIAL_COVERAGE_THRESHOLD,
} from "./assignmentTrends7d";
import type { AssignmentMetricsHourlyBucket } from "./assignmentTrends7d";

export type AssignmentLatencyApproximateMetricDto = {
  approximateMedianMinutes: number | null;
  sampleCount: number;
  status: AssignmentLatencyMetricStatus;
};

export type AssignmentLatencyTrends7d = {
  timeToAssigned: AssignmentLatencyApproximateMetricDto;
  cleanerResponse: AssignmentLatencyApproximateMetricDto;
  timeToFirstOffer: AssignmentLatencyApproximateMetricDto;
  coverageHours7d: number;
  coverageComplete: boolean;
  partialCoverageNote: string | null;
};

function histogramFromBucket<P extends LatencyHistogramMetricPrefix>(
  prefix: P,
  bucket: AssignmentMetricsHourlyBucket,
): LatencyHistogramCounts<P> {
  const counts: Record<string, number> = {};
  const suffixes = [
    "0_15m",
    "15_60m",
    "1_4h",
    "4_12h",
    "12_24h",
    "24_48h",
    "48h_plus",
  ] as const;

  for (const suffix of suffixes) {
    const column = `${prefix}_bucket_${suffix}_count`;
    counts[column] = (bucket[column as keyof AssignmentMetricsHourlyBucket] as number | undefined) ?? 0;
  }

  const sampleKey = `${prefix}_sample_count`;
  counts[sampleKey] =
    (bucket[sampleKey as keyof AssignmentMetricsHourlyBucket] as number | undefined) ?? 0;

  return counts as LatencyHistogramCounts<P>;
}

export function timeToAssignedHistogramFromBucket(
  bucket: AssignmentMetricsHourlyBucket,
): TimeToAssignedHistogramCounts {
  return histogramFromBucket("time_to_assigned", bucket);
}

export function cleanerResponseHistogramFromBucket(
  bucket: AssignmentMetricsHourlyBucket,
): CleanerResponseHistogramCounts {
  return histogramFromBucket("cleaner_response", bucket);
}

export function timeToFirstOfferHistogramFromBucket(
  bucket: AssignmentMetricsHourlyBucket,
): TimeToFirstOfferHistogramCounts {
  return histogramFromBucket("time_to_first_offer", bucket);
}

export function buildAssignmentLatencyApproximateMetricDto<P extends LatencyHistogramMetricPrefix>(
  prefix: P,
  histogram: LatencyHistogramCounts<P>,
): AssignmentLatencyApproximateMetricDto {
  const sampleCount = (histogram as Record<string, number>)[`${prefix}_sample_count`] ?? 0;

  if (sampleCount < ASSIGNMENT_LATENCY_MIN_SAMPLE) {
    return {
      approximateMedianMinutes: null,
      sampleCount,
      status: "insufficient_data",
    };
  }

  return {
    approximateMedianMinutes: approximateMedianMinutesFromLatencyHistogram(prefix, histogram),
    sampleCount,
    status: "ok",
  };
}

export function buildAssignmentLatencyTrends7d(
  buckets: AssignmentMetricsHourlyBucket[],
  now: Date = new Date(),
): AssignmentLatencyTrends7d {
  const { current7d } = partitionAssignmentBucketsByTrendWindow(buckets, now);

  const timeToAssignedMerged = mergeLatencyHistogramCounts(
    "time_to_assigned",
    current7d.map(timeToAssignedHistogramFromBucket),
  );
  const cleanerResponseMerged = mergeCleanerResponseHistogramCounts(
    current7d.map(cleanerResponseHistogramFromBucket),
  );
  const timeToFirstOfferMerged = mergeTimeToFirstOfferHistogramCounts(
    current7d.map(timeToFirstOfferHistogramFromBucket),
  );

  const coverageHours7d = current7d.length;
  const coverageComplete = coverageHours7d >= TRENDS_PARTIAL_COVERAGE_THRESHOLD;
  const partialCoverageNote = coverageComplete
    ? null
    : `7-day latency uses ${coverageHours7d} of ${TRENDS_FULL_COVERAGE_HOURS} expected hourly buckets. run the rollup cron or backfill.`;

  return {
    timeToAssigned: buildAssignmentLatencyApproximateMetricDto(
      "time_to_assigned",
      timeToAssignedMerged,
    ),
    cleanerResponse: buildAssignmentLatencyApproximateMetricDto(
      "cleaner_response",
      cleanerResponseMerged,
    ),
    timeToFirstOffer: buildAssignmentLatencyApproximateMetricDto(
      "time_to_first_offer",
      timeToFirstOfferMerged,
    ),
    coverageHours7d,
    coverageComplete,
    partialCoverageNote,
  };
}
