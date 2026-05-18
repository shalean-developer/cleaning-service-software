import type { AssignmentMetricsPathCounters } from "./assignmentMetricsAggregate";
import {
  computePathAcceptRateFromCreatedPercent,
  computePathAcceptRatePercent,
  countPathTerminalOffersInBucket,
  pathAcceptedCount,
  pathCreatedCount,
  type PathTerminalCounts,
} from "./assignmentAnalyticsPathMetrics";
import type { OfferMetricsInput } from "./assignmentMetricsAggregate";
import type { AssignmentAnalyticsPath } from "./resolveAssignmentAnalyticsPath";
import { ASSIGNMENT_ANALYTICS_PATHS } from "./resolveAssignmentAnalyticsPath";

export type AssignmentPathMetricsSnapshot = {
  offersCreated: number;
  offersAccepted: number;
  acceptRatePercent: number | null;
  acceptRateLabel: string;
};

export type AssignmentPathMetrics24h = Record<AssignmentAnalyticsPath, AssignmentPathMetricsSnapshot>;

const NOT_ENOUGH_DATA = "Not enough data";

export function buildAssignmentPathMetrics24h(
  pathCounters: AssignmentMetricsPathCounters,
  pathTerminals: PathTerminalCounts,
): AssignmentPathMetrics24h {
  const result = {} as AssignmentPathMetrics24h;

  for (const path of ASSIGNMENT_ANALYTICS_PATHS) {
    const offersCreated = pathCreatedCount(pathCounters, path);
    const offersAccepted = pathAcceptedCount(pathCounters, path);
    const terminalOffers = pathTerminals[path];
    const acceptRatePercent = computePathAcceptRatePercent(offersAccepted, terminalOffers);

    result[path] = {
      offersCreated,
      offersAccepted,
      acceptRatePercent,
      acceptRateLabel:
        acceptRatePercent != null
          ? `${acceptRatePercent}%`
          : NOT_ENOUGH_DATA,
    };
  }

  return result;
}

export function buildAssignmentPathMetrics24hFromOffers(
  bucketStart: Date,
  bucketEnd: Date,
  _offersCreatedInBucket: readonly OfferMetricsInput[],
  terminalOffers: readonly OfferMetricsInput[],
  pathCounters: AssignmentMetricsPathCounters,
  pathByBookingId: ReadonlyMap<string, AssignmentAnalyticsPath>,
): AssignmentPathMetrics24h {
  const pathTerminals = countPathTerminalOffersInBucket(
    terminalOffers,
    bucketStart,
    bucketEnd,
    pathByBookingId,
  );
  return buildAssignmentPathMetrics24h(pathCounters, pathTerminals);
}

export type AssignmentPathTrend7d = {
  offersCreated7d: number;
  offersAccepted7d: number;
  acceptRate7dPercent: number | null;
  acceptRate7dLabel: string;
};

export type AssignmentPathTrends7d = Record<AssignmentAnalyticsPath, AssignmentPathTrend7d>;

export function buildAssignmentPathTrends7d(
  pathCounters: AssignmentMetricsPathCounters,
): AssignmentPathTrends7d {
  const result = {} as AssignmentPathTrends7d;

  for (const path of ASSIGNMENT_ANALYTICS_PATHS) {
    const offersCreated7d = pathCreatedCount(pathCounters, path);
    const offersAccepted7d = pathAcceptedCount(pathCounters, path);
    const acceptRate7dPercent = computePathAcceptRateFromCreatedPercent(
      offersAccepted7d,
      offersCreated7d,
    );

    result[path] = {
      offersCreated7d,
      offersAccepted7d,
      acceptRate7dPercent,
      acceptRate7dLabel:
        acceptRate7dPercent != null ? `${acceptRate7dPercent}%` : NOT_ENOUGH_DATA,
    };
  }

  return result;
}
