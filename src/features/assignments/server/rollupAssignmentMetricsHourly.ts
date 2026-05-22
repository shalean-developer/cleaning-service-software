import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { aggregateAssignmentMetricsHourly } from "./assignmentMetricsAggregate";
import { aggregateAssignmentMetricsPathHourly } from "./assignmentAnalyticsPathMetrics";
import {
  buildAssignmentAnalyticsPathByBookingId,
  fetchAcceptAssignmentAuditsInBucket,
  fetchAdminInterventionCountInBucket,
  fetchFirstPendingAssignmentAuditByBookingIds,
  fetchOffersCreatedInBucket,
  fetchOffersForBookings,
  fetchTerminalOffersInBucket,
} from "./assignmentAnalyticsRollupQueries";
import {
  collectCleanerResponseDurationsMinutes,
  collectTimeToAssignedDurationsMinutes,
  collectTimeToFirstOfferDurationsMinutes,
} from "./assignmentLatencyMetrics";
import {
  durationsToCleanerResponseHistogram,
  durationsToTimeToAssignedHistogram,
  durationsToTimeToFirstOfferHistogram,
} from "./assignmentLatencyHistogram";
import {
  ASSIGNMENT_METRICS_BACKFILL_CONCURRENCY,
  ASSIGNMENT_METRICS_MAX_BACKFILL_HOURS,
  bucketEndExclusive,
  isCurrentPartialUtcHour,
  parseUtcHourBucketStart,
  previousClosedUtcHour,
} from "./assignmentMetricsHourlyUtc";
import type { OfferMetricsInput } from "./assignmentMetricsAggregate";

export type AssignmentMetricsHourlyRow = {
  bucket_start: string;
  offers_created_count: number;
  offers_accepted_count: number;
  offers_declined_count: number;
  offers_expired_count: number;
  offers_cancelled_count: number;
  bookings_assigned_count: number;
  redispatch_booking_count: number;
  max_attempts_booking_count: number;
  admin_intervention_count: number;
  offers_created_selected_count: number;
  offers_created_best_available_count: number;
  offers_created_admin_manual_count: number;
  offers_created_unknown_count: number;
  offers_accepted_selected_count: number;
  offers_accepted_best_available_count: number;
  offers_accepted_admin_manual_count: number;
  offers_accepted_unknown_count: number;
  time_to_assigned_bucket_0_15m_count: number;
  time_to_assigned_bucket_15_60m_count: number;
  time_to_assigned_bucket_1_4h_count: number;
  time_to_assigned_bucket_4_12h_count: number;
  time_to_assigned_bucket_12_24h_count: number;
  time_to_assigned_bucket_24_48h_count: number;
  time_to_assigned_bucket_48h_plus_count: number;
  time_to_assigned_sample_count: number;
  cleaner_response_bucket_0_15m_count: number;
  cleaner_response_bucket_15_60m_count: number;
  cleaner_response_bucket_1_4h_count: number;
  cleaner_response_bucket_4_12h_count: number;
  cleaner_response_bucket_12_24h_count: number;
  cleaner_response_bucket_24_48h_count: number;
  cleaner_response_bucket_48h_plus_count: number;
  cleaner_response_sample_count: number;
  time_to_first_offer_bucket_0_15m_count: number;
  time_to_first_offer_bucket_15_60m_count: number;
  time_to_first_offer_bucket_1_4h_count: number;
  time_to_first_offer_bucket_4_12h_count: number;
  time_to_first_offer_bucket_12_24h_count: number;
  time_to_first_offer_bucket_24_48h_count: number;
  time_to_first_offer_bucket_48h_plus_count: number;
  time_to_first_offer_sample_count: number;
  created_at?: string;
  updated_at?: string;
};

export type RollupAssignmentMetricsHourlyResult = {
  bucketStart: string;
  offersCreated: number;
  offersAccepted: number;
  bookingsAssigned: number;
  upserted: boolean;
};

export function isAssignmentMetricsRollupEnabled(): boolean {
  const raw = process.env.ASSIGNMENT_METRICS_ROLLUP_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  return true;
}

export function resolveRollupBucketStart(
  bucketStartParam: string | null | undefined,
  now: Date = new Date(),
): Date {
  if (bucketStartParam) {
    const parsed = parseUtcHourBucketStart(bucketStartParam);
    if (!parsed) {
      throw new Error("Invalid bucketStart. expected UTC hour ISO timestamp.");
    }
    if (isCurrentPartialUtcHour(parsed, now)) {
      throw new Error("Cannot roll up the current partial UTC hour.");
    }
    return parsed;
  }
  return previousClosedUtcHour(now);
}

export async function rollupAssignmentMetricsHourly(
  client: SupabaseClient<Database>,
  bucketStartParam?: string | null,
  now: Date = new Date(),
): Promise<RollupAssignmentMetricsHourlyResult> {
  const bucketStart = resolveRollupBucketStart(bucketStartParam, now);
  const bucketEnd = bucketEndExclusive(bucketStart);
  const bucketStartIso = bucketStart.toISOString();
  const bucketEndIso = bucketEnd.toISOString();

  const [offersCreatedInBucket, terminalOffers, acceptAudits, adminInterventionCount] =
    await Promise.all([
      fetchOffersCreatedInBucket(client, bucketStartIso, bucketEndIso),
      fetchTerminalOffersInBucket(client, bucketStartIso, bucketEndIso),
      fetchAcceptAssignmentAuditsInBucket(client, bucketStartIso, bucketEndIso),
      fetchAdminInterventionCountInBucket(client, bucketStartIso, bucketEndIso),
    ]);

  const assignedBookingIds = acceptAudits.map((row) => row.booking_id);

  const bookingIdsFromCreated = offersCreatedInBucket.map((o) => o.booking_id);
  const bookingIdsFromTerminal = terminalOffers.map((o) => o.booking_id);
  const bookingIds = [...new Set([...bookingIdsFromCreated, ...bookingIdsFromTerminal])];

  const [historyOffers, pathByBookingId] = await Promise.all([
    fetchOffersForBookings(client, bookingIdsFromCreated, bucketEndIso),
    buildAssignmentAnalyticsPathByBookingId(client, bookingIds),
  ]);
  const allOffersForTouchedBookings = mergeOffersByKey([...historyOffers, ...offersCreatedInBucket]);

  const counters = aggregateAssignmentMetricsHourly(
    bucketStart,
    bucketEnd,
    offersCreatedInBucket,
    allOffersForTouchedBookings,
    terminalOffers,
    assignedBookingIds,
    adminInterventionCount,
  );

  const pathCounters = aggregateAssignmentMetricsPathHourly(
    bucketStart,
    bucketEnd,
    offersCreatedInBucket,
    terminalOffers,
    pathByBookingId,
  );

  const latencyBookingIds = [
    ...new Set([...assignedBookingIds, ...bookingIdsFromCreated]),
  ];
  const pendingByBookingId = await fetchFirstPendingAssignmentAuditByBookingIds(
    client,
    latencyBookingIds,
  );

  const timeToAssignedHistogram = durationsToTimeToAssignedHistogram(
    collectTimeToAssignedDurationsMinutes(acceptAudits, pendingByBookingId),
  );
  const cleanerResponseHistogram = durationsToCleanerResponseHistogram(
    collectCleanerResponseDurationsMinutes(terminalOffers, bucketStart, bucketEnd),
  );
  const timeToFirstOfferHistogram = durationsToTimeToFirstOfferHistogram(
    collectTimeToFirstOfferDurationsMinutes(
      allOffersForTouchedBookings,
      pendingByBookingId,
      bucketStart,
      bucketEnd,
    ),
  );

  const row: AssignmentMetricsHourlyRow = {
    bucket_start: bucketStartIso,
    ...counters,
    ...pathCounters,
    ...timeToAssignedHistogram,
    ...cleanerResponseHistogram,
    ...timeToFirstOfferHistogram,
    updated_at: now.toISOString(),
  };

  const { error: upsertError } = await client.from("assignment_metrics_hourly").upsert(row, {
    onConflict: "bucket_start",
  });

  if (upsertError) throw new Error(upsertError.message);

  return {
    bucketStart: bucketStartIso,
    offersCreated: counters.offers_created_count,
    offersAccepted: counters.offers_accepted_count,
    bookingsAssigned: counters.bookings_assigned_count,
    upserted: true,
  };
}

function mergeOffersByKey(offers: readonly OfferMetricsInput[]): OfferMetricsInput[] {
  const map = new Map<string, OfferMetricsInput>();
  for (const offer of offers) {
    map.set(`${offer.booking_id}:${offer.offered_at}`, offer);
  }
  return [...map.values()];
}

export function listBackfillBucketStarts(hours: number, now: Date = new Date()): Date[] {
  const closed = previousClosedUtcHour(now);
  const bucketStarts: Date[] = [];
  for (let i = hours; i >= 1; i -= 1) {
    bucketStarts.push(new Date(closed.getTime() - (i - 1) * 60 * 60_000));
  }
  return bucketStarts;
}

export type BackfillAssignmentMetricsHourlyResult = {
  hoursRequested: number;
  hoursProcessed: number;
  hoursFailed: number;
};

export async function backfillAssignmentMetricsHourly(
  client: SupabaseClient<Database>,
  options: {
    hours?: number;
    now?: Date;
    concurrency?: number;
  } = {},
): Promise<BackfillAssignmentMetricsHourlyResult> {
  const now = options.now ?? new Date();
  const hours = Math.min(
    Math.max(1, options.hours ?? ASSIGNMENT_METRICS_MAX_BACKFILL_HOURS),
    ASSIGNMENT_METRICS_MAX_BACKFILL_HOURS,
  );
  const concurrency = options.concurrency ?? ASSIGNMENT_METRICS_BACKFILL_CONCURRENCY;
  const bucketStarts = listBackfillBucketStarts(hours, now);

  let hoursProcessed = 0;
  let hoursFailed = 0;
  const batchSize = Math.min(Math.max(1, concurrency), bucketStarts.length);

  for (let offset = 0; offset < bucketStarts.length; offset += batchSize) {
    const chunk = bucketStarts.slice(offset, offset + batchSize);
    const outcomes = await Promise.all(
      chunk.map(async (bucketStart) => {
        try {
          await rollupAssignmentMetricsHourly(client, bucketStart.toISOString(), now);
          return true;
        } catch {
          return false;
        }
      }),
    );
    hoursProcessed += outcomes.filter(Boolean).length;
    hoursFailed += outcomes.filter((ok) => !ok).length;
  }

  return { hoursRequested: hours, hoursProcessed, hoursFailed };
}
