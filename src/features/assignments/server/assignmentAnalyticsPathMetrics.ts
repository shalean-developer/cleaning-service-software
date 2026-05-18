import type { AssignmentOfferStatus } from "@/lib/database/types";
import type { AssignmentMetricsPathCounters, OfferMetricsInput } from "./assignmentMetricsAggregate";
import { terminalEventTimestamp } from "./assignmentMetricsAggregate";
import { isTimestampInBucket } from "./assignmentMetricsHourlyUtc";
import type { AssignmentAnalyticsPath } from "./resolveAssignmentAnalyticsPath";
import { ASSIGNMENT_ANALYTICS_PATHS } from "./resolveAssignmentAnalyticsPath";

export const PATH_ACCEPT_RATE_MIN_TERMINAL = 10;

export function emptyAssignmentMetricsPathCounters(): AssignmentMetricsPathCounters {
  return {
    offers_created_selected_count: 0,
    offers_created_best_available_count: 0,
    offers_created_admin_manual_count: 0,
    offers_created_unknown_count: 0,
    offers_accepted_selected_count: 0,
    offers_accepted_best_available_count: 0,
    offers_accepted_admin_manual_count: 0,
    offers_accepted_unknown_count: 0,
  };
}

function pathCreatedField(path: AssignmentAnalyticsPath): keyof AssignmentMetricsPathCounters {
  return `offers_created_${path}_count` as keyof AssignmentMetricsPathCounters;
}

function pathAcceptedField(path: AssignmentAnalyticsPath): keyof AssignmentMetricsPathCounters {
  return `offers_accepted_${path}_count` as keyof AssignmentMetricsPathCounters;
}

export function aggregateAssignmentMetricsPathHourly(
  bucketStart: Date,
  bucketEnd: Date,
  offersCreatedInBucket: readonly OfferMetricsInput[],
  terminalOffers: readonly OfferMetricsInput[],
  pathByBookingId: ReadonlyMap<string, AssignmentAnalyticsPath>,
): AssignmentMetricsPathCounters {
  const counters = emptyAssignmentMetricsPathCounters();

  for (const offer of offersCreatedInBucket) {
    const path = pathByBookingId.get(offer.booking_id) ?? "unknown";
    const field = pathCreatedField(path);
    counters[field] += 1;
  }

  for (const offer of terminalOffers) {
    if (offer.status !== "accepted") continue;
    const ts = terminalEventTimestamp(offer);
    if (!isTimestampInBucket(ts, bucketStart, bucketEnd)) continue;
    const path = pathByBookingId.get(offer.booking_id) ?? "unknown";
    const field = pathAcceptedField(path);
    counters[field] += 1;
  }

  return counters;
}

export function sumAssignmentMetricsPathCounters(
  rows: readonly AssignmentMetricsPathCounters[],
): AssignmentMetricsPathCounters {
  return rows.reduce(
    (acc, row) => ({
      offers_created_selected_count:
        acc.offers_created_selected_count + row.offers_created_selected_count,
      offers_created_best_available_count:
        acc.offers_created_best_available_count + row.offers_created_best_available_count,
      offers_created_admin_manual_count:
        acc.offers_created_admin_manual_count + row.offers_created_admin_manual_count,
      offers_created_unknown_count:
        acc.offers_created_unknown_count + row.offers_created_unknown_count,
      offers_accepted_selected_count:
        acc.offers_accepted_selected_count + row.offers_accepted_selected_count,
      offers_accepted_best_available_count:
        acc.offers_accepted_best_available_count + row.offers_accepted_best_available_count,
      offers_accepted_admin_manual_count:
        acc.offers_accepted_admin_manual_count + row.offers_accepted_admin_manual_count,
      offers_accepted_unknown_count:
        acc.offers_accepted_unknown_count + row.offers_accepted_unknown_count,
    }),
    emptyAssignmentMetricsPathCounters(),
  );
}

export function sumPathCreatedCounts(counters: AssignmentMetricsPathCounters): number {
  return (
    counters.offers_created_selected_count +
    counters.offers_created_best_available_count +
    counters.offers_created_admin_manual_count +
    counters.offers_created_unknown_count
  );
}

export function sumPathAcceptedCounts(counters: AssignmentMetricsPathCounters): number {
  return (
    counters.offers_accepted_selected_count +
    counters.offers_accepted_best_available_count +
    counters.offers_accepted_admin_manual_count +
    counters.offers_accepted_unknown_count
  );
}

export type PathTerminalCounts = Record<AssignmentAnalyticsPath, number>;

export function countPathTerminalOffersInBucket(
  terminalOffers: readonly OfferMetricsInput[],
  bucketStart: Date,
  bucketEnd: Date,
  pathByBookingId: ReadonlyMap<string, AssignmentAnalyticsPath>,
): PathTerminalCounts {
  const counts: PathTerminalCounts = {
    selected: 0,
    best_available: 0,
    admin_manual: 0,
    unknown: 0,
  };

  const terminalStatuses: AssignmentOfferStatus[] = [
    "accepted",
    "declined",
    "expired",
    "cancelled",
  ];

  for (const offer of terminalOffers) {
    if (!terminalStatuses.includes(offer.status)) continue;
    const ts = terminalEventTimestamp(offer);
    if (!isTimestampInBucket(ts, bucketStart, bucketEnd)) continue;
    const path = pathByBookingId.get(offer.booking_id) ?? "unknown";
    counts[path] += 1;
  }

  return counts;
}

export function pathCreatedCount(
  counters: AssignmentMetricsPathCounters,
  path: AssignmentAnalyticsPath,
): number {
  return counters[pathCreatedField(path)];
}

export function pathAcceptedCount(
  counters: AssignmentMetricsPathCounters,
  path: AssignmentAnalyticsPath,
): number {
  return counters[pathAcceptedField(path)];
}

export function computePathAcceptRatePercent(
  accepted: number,
  terminalDenominator: number,
): number | null {
  if (terminalDenominator < PATH_ACCEPT_RATE_MIN_TERMINAL) return null;
  if (terminalDenominator <= 0) return null;
  return Math.round((accepted / terminalDenominator) * 1000) / 10;
}

export function computePathAcceptRateFromCreatedPercent(
  accepted: number,
  created: number,
): number | null {
  if (created < PATH_ACCEPT_RATE_MIN_TERMINAL) return null;
  if (created <= 0) return null;
  return Math.round((accepted / created) * 1000) / 10;
}

export { ASSIGNMENT_ANALYTICS_PATHS };
