import type { AssignmentOfferStatus } from "@/lib/database/types";
import { ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING } from "./constants";
import { isTimestampInBucket } from "./assignmentMetricsHourlyUtc";

export type OfferMetricsInput = {
  booking_id: string;
  status: AssignmentOfferStatus;
  offered_at: string;
  responded_at: string | null;
  updated_at: string;
};

export type AssignmentMetricsHourlyCounters = {
  offers_created_count: number;
  offers_accepted_count: number;
  offers_declined_count: number;
  offers_expired_count: number;
  offers_cancelled_count: number;
  bookings_assigned_count: number;
  redispatch_booking_count: number;
  max_attempts_booking_count: number;
  admin_intervention_count: number;
};

/** Path-split offer counters (7B-1b-min). */
export type AssignmentMetricsPathCounters = {
  offers_created_selected_count: number;
  offers_created_best_available_count: number;
  offers_created_admin_manual_count: number;
  offers_created_unknown_count: number;
  offers_accepted_selected_count: number;
  offers_accepted_best_available_count: number;
  offers_accepted_admin_manual_count: number;
  offers_accepted_unknown_count: number;
};

export type AssignmentMetricsHourlyCountersWithPath = AssignmentMetricsHourlyCounters &
  AssignmentMetricsPathCounters;

export function terminalEventTimestamp(offer: OfferMetricsInput): string | null {
  switch (offer.status) {
    case "accepted":
    case "declined":
    case "cancelled":
      return offer.responded_at;
    case "expired":
      return offer.responded_at ?? offer.updated_at;
    default:
      return null;
  }
}

function countTerminalInBucket(
  offers: readonly OfferMetricsInput[],
  bucketStart: Date,
  bucketEnd: Date,
  status: AssignmentOfferStatus,
): number {
  return offers.filter((offer) => {
    if (offer.status !== status) return false;
    return isTimestampInBucket(terminalEventTimestamp(offer), bucketStart, bucketEnd);
  }).length;
}

function countRedispatchBookings(
  offersCreatedInBucket: readonly OfferMetricsInput[],
  allOffersForBookings: readonly OfferMetricsInput[],
): number {
  const redispatchBookings = new Set<string>();

  const offersByBooking = new Map<string, OfferMetricsInput[]>();
  for (const offer of allOffersForBookings) {
    const list = offersByBooking.get(offer.booking_id) ?? [];
    list.push(offer);
    offersByBooking.set(offer.booking_id, list);
  }

  for (const offer of offersCreatedInBucket) {
    const history = offersByBooking.get(offer.booking_id) ?? [];
    const priorCount = history.filter(
      (row) => Date.parse(row.offered_at) < Date.parse(offer.offered_at),
    ).length;
    if (priorCount > 0) {
      redispatchBookings.add(offer.booking_id);
    }
  }

  return redispatchBookings.size;
}

function countMaxAttemptsBookings(
  offersCreatedInBucket: readonly OfferMetricsInput[],
  allOffersForBookings: readonly OfferMetricsInput[],
): number {
  const maxAttemptBookings = new Set<string>();
  const offersByBooking = new Map<string, OfferMetricsInput[]>();

  for (const offer of allOffersForBookings) {
    const list = offersByBooking.get(offer.booking_id) ?? [];
    list.push(offer);
    offersByBooking.set(offer.booking_id, list);
  }

  for (const offer of offersCreatedInBucket) {
    const history = [...(offersByBooking.get(offer.booking_id) ?? [])].sort(
      (a, b) => Date.parse(a.offered_at) - Date.parse(b.offered_at),
    );
    const index = history.findIndex((row) => row.offered_at === offer.offered_at);
    if (index === ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING - 1) {
      maxAttemptBookings.add(offer.booking_id);
    }
  }

  return maxAttemptBookings.size;
}

/** Pure aggregation for one UTC hour bucket (7B-1a). */
export function aggregateAssignmentMetricsHourly(
  bucketStart: Date,
  bucketEnd: Date,
  offersCreatedInBucket: readonly OfferMetricsInput[],
  allOffersForTouchedBookings: readonly OfferMetricsInput[],
  allOffersForTerminalCounts: readonly OfferMetricsInput[],
  assignedBookingIds: readonly string[],
  adminInterventionCount: number,
): AssignmentMetricsHourlyCounters {
  return {
    offers_created_count: offersCreatedInBucket.length,
    offers_accepted_count: countTerminalInBucket(
      allOffersForTerminalCounts,
      bucketStart,
      bucketEnd,
      "accepted",
    ),
    offers_declined_count: countTerminalInBucket(
      allOffersForTerminalCounts,
      bucketStart,
      bucketEnd,
      "declined",
    ),
    offers_expired_count: countTerminalInBucket(
      allOffersForTerminalCounts,
      bucketStart,
      bucketEnd,
      "expired",
    ),
    offers_cancelled_count: countTerminalInBucket(
      allOffersForTerminalCounts,
      bucketStart,
      bucketEnd,
      "cancelled",
    ),
    bookings_assigned_count: new Set(assignedBookingIds).size,
    redispatch_booking_count: countRedispatchBookings(
      offersCreatedInBucket,
      allOffersForTouchedBookings,
    ),
    max_attempts_booking_count: countMaxAttemptsBookings(
      offersCreatedInBucket,
      allOffersForTouchedBookings,
    ),
    admin_intervention_count: adminInterventionCount,
  };
}

export function sumAssignmentMetricsCounters(
  rows: readonly AssignmentMetricsHourlyCounters[],
): AssignmentMetricsHourlyCounters {
  return rows.reduce(
    (acc, row) => ({
      offers_created_count: acc.offers_created_count + row.offers_created_count,
      offers_accepted_count: acc.offers_accepted_count + row.offers_accepted_count,
      offers_declined_count: acc.offers_declined_count + row.offers_declined_count,
      offers_expired_count: acc.offers_expired_count + row.offers_expired_count,
      offers_cancelled_count: acc.offers_cancelled_count + row.offers_cancelled_count,
      bookings_assigned_count: acc.bookings_assigned_count + row.bookings_assigned_count,
      redispatch_booking_count: acc.redispatch_booking_count + row.redispatch_booking_count,
      max_attempts_booking_count: acc.max_attempts_booking_count + row.max_attempts_booking_count,
      admin_intervention_count: acc.admin_intervention_count + row.admin_intervention_count,
    }),
    {
      offers_created_count: 0,
      offers_accepted_count: 0,
      offers_declined_count: 0,
      offers_expired_count: 0,
      offers_cancelled_count: 0,
      bookings_assigned_count: 0,
      redispatch_booking_count: 0,
      max_attempts_booking_count: 0,
      admin_intervention_count: 0,
    },
  );
}

export function computeTerminalOfferCount(counters: AssignmentMetricsHourlyCounters): number {
  return (
    counters.offers_accepted_count +
    counters.offers_declined_count +
    counters.offers_expired_count +
    counters.offers_cancelled_count
  );
}

export function computeAcceptRatePercent(counters: AssignmentMetricsHourlyCounters): number | null {
  const terminal = computeTerminalOfferCount(counters);
  if (terminal <= 0) return null;
  return Math.round((counters.offers_accepted_count / terminal) * 1000) / 10;
}

export function computeRatePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}
