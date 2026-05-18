import { ASSIGNMENT_LATENCY_MIN_SAMPLE } from "./assignmentLatencyMetrics";

/** Shared duration buckets for all assignment latency histogram rollups (minutes). */
export const LATENCY_DURATION_BUCKETS = [
  { key: "0_15m", lowerMinutes: 0, upperMinutes: 15, midpointMinutes: 7.5 },
  { key: "15_60m", lowerMinutes: 15, upperMinutes: 60, midpointMinutes: 37.5 },
  { key: "1_4h", lowerMinutes: 60, upperMinutes: 240, midpointMinutes: 150 },
  { key: "4_12h", lowerMinutes: 240, upperMinutes: 720, midpointMinutes: 480 },
  { key: "12_24h", lowerMinutes: 720, upperMinutes: 1440, midpointMinutes: 1080 },
  { key: "24_48h", lowerMinutes: 1440, upperMinutes: 2880, midpointMinutes: 2160 },
  { key: "48h_plus", lowerMinutes: 2880, upperMinutes: null, midpointMinutes: 4320 },
] as const;

/** @deprecated Use LATENCY_DURATION_BUCKETS */
export const TIME_TO_ASSIGNED_DURATION_BUCKETS = LATENCY_DURATION_BUCKETS;

const BUCKET_KEY_SUFFIXES = [
  "0_15m",
  "15_60m",
  "1_4h",
  "4_12h",
  "12_24h",
  "24_48h",
  "48h_plus",
] as const;

export type LatencyHistogramMetricPrefix =
  | "time_to_assigned"
  | "cleaner_response"
  | "time_to_first_offer";

type BucketKeySuffix = (typeof BUCKET_KEY_SUFFIXES)[number];

export type TimeToAssignedHistogramCounts = LatencyHistogramCounts<"time_to_assigned">;
export type CleanerResponseHistogramCounts = LatencyHistogramCounts<"cleaner_response">;
export type TimeToFirstOfferHistogramCounts = LatencyHistogramCounts<"time_to_first_offer">;

export type LatencyHistogramCounts<P extends LatencyHistogramMetricPrefix> = {
  [K in BucketKeySuffix as `${P}_bucket_${K}_count`]: number;
} & {
  [K in `${P}_sample_count`]: number;
};

function bucketColumnName<P extends LatencyHistogramMetricPrefix>(
  prefix: P,
  suffix: BucketKeySuffix,
): `${P}_bucket_${BucketKeySuffix}_count` {
  return `${prefix}_bucket_${suffix}_count`;
}

function sampleCountColumnName<P extends LatencyHistogramMetricPrefix>(
  prefix: P,
): `${P}_sample_count` {
  return `${prefix}_sample_count`;
}

function bucketColumnNames<P extends LatencyHistogramMetricPrefix>(
  prefix: P,
): `${P}_bucket_${BucketKeySuffix}_count`[] {
  return BUCKET_KEY_SUFFIXES.map((suffix) => bucketColumnName(prefix, suffix));
}

export function durationMinutesToBucketIndex(durationMinutes: number): number | null {
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) return null;

  for (let index = LATENCY_DURATION_BUCKETS.length - 1; index >= 0; index -= 1) {
    if (durationMinutes >= LATENCY_DURATION_BUCKETS[index]!.lowerMinutes) {
      return index;
    }
  }

  return null;
}

function histogramCountsRecord<P extends LatencyHistogramMetricPrefix>(
  prefix: P,
): Record<string, number> {
  const record: Record<string, number> = {};
  for (const suffix of BUCKET_KEY_SUFFIXES) {
    record[bucketColumnName(prefix, suffix)] = 0;
  }
  record[sampleCountColumnName(prefix)] = 0;
  return record;
}

export function emptyLatencyHistogramCounts<P extends LatencyHistogramMetricPrefix>(
  prefix: P,
): LatencyHistogramCounts<P> {
  return histogramCountsRecord(prefix) as LatencyHistogramCounts<P>;
}

export function durationsToLatencyHistogram<P extends LatencyHistogramMetricPrefix>(
  prefix: P,
  durationsMinutes: readonly number[],
): LatencyHistogramCounts<P> {
  const counts = histogramCountsRecord(prefix);
  const columns = bucketColumnNames(prefix);
  const sampleKey = sampleCountColumnName(prefix);

  for (const duration of durationsMinutes) {
    const index = durationMinutesToBucketIndex(duration);
    if (index == null) continue;
    const column = columns[index];
    if (!column) continue;
    counts[column] = (counts[column] ?? 0) + 1;
    counts[sampleKey] = (counts[sampleKey] ?? 0) + 1;
  }

  return counts as LatencyHistogramCounts<P>;
}

export function mergeLatencyHistogramCounts<P extends LatencyHistogramMetricPrefix>(
  prefix: P,
  rows: readonly Partial<LatencyHistogramCounts<P>>[],
): LatencyHistogramCounts<P> {
  const merged = histogramCountsRecord(prefix);
  const columns = bucketColumnNames(prefix);
  const sampleKey = sampleCountColumnName(prefix);

  for (const row of rows) {
    const partial = row as Record<string, number>;
    for (const column of columns) {
      merged[column] = (merged[column] ?? 0) + (partial[column] ?? 0);
    }
    merged[sampleKey] = (merged[sampleKey] ?? 0) + (partial[sampleKey] ?? 0);
  }

  return merged as LatencyHistogramCounts<P>;
}

function histogramCountsToBucketArray<P extends LatencyHistogramMetricPrefix>(
  prefix: P,
  counts: LatencyHistogramCounts<P>,
): number[] {
  const record = counts as Record<string, number>;
  return bucketColumnNames(prefix).map((column) => record[column] ?? 0);
}

export function approximateMedianMinutesFromLatencyHistogram<
  P extends LatencyHistogramMetricPrefix,
>(prefix: P, counts: LatencyHistogramCounts<P>): number | null {
  const sampleKey = sampleCountColumnName(prefix);
  const sampleSize = (counts as Record<string, number>)[sampleKey] ?? 0;
  if (sampleSize < ASSIGNMENT_LATENCY_MIN_SAMPLE) return null;

  const bucketCounts = histogramCountsToBucketArray(prefix, counts);
  const targetRank = Math.ceil(sampleSize / 2);
  let cumulative = 0;

  for (let index = 0; index < bucketCounts.length; index += 1) {
    cumulative += bucketCounts[index] ?? 0;
    if (cumulative >= targetRank) {
      return LATENCY_DURATION_BUCKETS[index]?.midpointMinutes ?? null;
    }
  }

  return null;
}

export function emptyTimeToAssignedHistogramCounts(): TimeToAssignedHistogramCounts {
  return emptyLatencyHistogramCounts("time_to_assigned");
}

export function durationsToTimeToAssignedHistogram(
  durationsMinutes: readonly number[],
): TimeToAssignedHistogramCounts {
  return durationsToLatencyHistogram("time_to_assigned", durationsMinutes);
}

export function mergeTimeToAssignedHistogramCounts(
  rows: readonly Partial<TimeToAssignedHistogramCounts>[],
): TimeToAssignedHistogramCounts {
  return mergeLatencyHistogramCounts("time_to_assigned", rows);
}

export function approximateMedianMinutesFromHistogram(
  counts: TimeToAssignedHistogramCounts,
): number | null {
  return approximateMedianMinutesFromLatencyHistogram("time_to_assigned", counts);
}

export function emptyCleanerResponseHistogramCounts(): CleanerResponseHistogramCounts {
  return emptyLatencyHistogramCounts("cleaner_response");
}

export function durationsToCleanerResponseHistogram(
  durationsMinutes: readonly number[],
): CleanerResponseHistogramCounts {
  return durationsToLatencyHistogram("cleaner_response", durationsMinutes);
}

export function mergeCleanerResponseHistogramCounts(
  rows: readonly Partial<CleanerResponseHistogramCounts>[],
): CleanerResponseHistogramCounts {
  return mergeLatencyHistogramCounts("cleaner_response", rows);
}

export function emptyTimeToFirstOfferHistogramCounts(): TimeToFirstOfferHistogramCounts {
  return emptyLatencyHistogramCounts("time_to_first_offer");
}

export function durationsToTimeToFirstOfferHistogram(
  durationsMinutes: readonly number[],
): TimeToFirstOfferHistogramCounts {
  return durationsToLatencyHistogram("time_to_first_offer", durationsMinutes);
}

export function mergeTimeToFirstOfferHistogramCounts(
  rows: readonly Partial<TimeToFirstOfferHistogramCounts>[],
): TimeToFirstOfferHistogramCounts {
  return mergeLatencyHistogramCounts("time_to_first_offer", rows);
}
