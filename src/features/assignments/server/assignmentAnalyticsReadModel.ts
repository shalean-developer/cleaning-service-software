import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aggregateAssignmentMetricsPathHourly } from "./assignmentAnalyticsPathMetrics";
import {
  buildAssignmentPathMetrics24hFromOffers,
  type AssignmentPathMetrics24h,
} from "./assignmentAnalyticsPathDto";
import {
  aggregateAssignmentMetricsHourly,
  computeAcceptRatePercent,
  computeRatePercent,
  computeTerminalOfferCount,
} from "./assignmentMetricsAggregate";
import { buildAssignmentTrends7d, type AdminAssignmentTrends7d } from "./assignmentTrends7d";
import type { AssignmentMetricsHourlyBucket } from "./assignmentTrends7d";
import {
  buildAssignmentLatencyTrends7d,
  type AssignmentLatencyTrends7d,
} from "./assignmentLatencyTrends7d";
import { bucketEndExclusive, floorToUtcHour } from "./assignmentMetricsHourlyUtc";
import {
  buildAssignmentAnalyticsPathByBookingId,
  fetchAcceptAssignmentAuditsInBucket,
  fetchAdminInterventionCountInBucket,
  fetchFirstPendingAssignmentAuditByBookingIds,
  fetchOffersCreatedInBucket,
  fetchOffersForBookings,
  fetchTerminalOffersInBucket,
} from "./assignmentAnalyticsRollupQueries";
import type { AssignmentLatency24h } from "./assignmentLatencyDto";
import { computeAssignmentLatency24h } from "./assignmentLatencyReadModel";

export type AdminAssignmentAnalytics24h = {
  offersCreated: number;
  offersAccepted: number;
  offersDeclined: number;
  offersExpired: number;
  offersCancelled: number;
  terminalOffers: number;
  acceptRatePercent: number | null;
  declineRatePercent: number | null;
  expireRatePercent: number | null;
  bookingsAssigned: number;
  redispatchBookings: number;
  maxAttemptsBookings: number;
  adminInterventions: number;
  byPath: AssignmentPathMetrics24h;
  latency24h: AssignmentLatency24h;
};

export type AdminAssignmentAnalyticsPage = {
  live24h: AdminAssignmentAnalytics24h;
  trends7d: AdminAssignmentTrends7d;
  latencyTrends7d: AssignmentLatencyTrends7d;
};

const METRICS_HOURLY_SELECT =
  "bucket_start, offers_created_count, offers_accepted_count, offers_declined_count, offers_expired_count, offers_cancelled_count, bookings_assigned_count, redispatch_booking_count, max_attempts_booking_count, admin_intervention_count, offers_created_selected_count, offers_created_best_available_count, offers_created_admin_manual_count, offers_created_unknown_count, offers_accepted_selected_count, offers_accepted_best_available_count, offers_accepted_admin_manual_count, offers_accepted_unknown_count, time_to_assigned_bucket_0_15m_count, time_to_assigned_bucket_15_60m_count, time_to_assigned_bucket_1_4h_count, time_to_assigned_bucket_4_12h_count, time_to_assigned_bucket_12_24h_count, time_to_assigned_bucket_24_48h_count, time_to_assigned_bucket_48h_plus_count, time_to_assigned_sample_count, cleaner_response_bucket_0_15m_count, cleaner_response_bucket_15_60m_count, cleaner_response_bucket_1_4h_count, cleaner_response_bucket_4_12h_count, cleaner_response_bucket_12_24h_count, cleaner_response_bucket_24_48h_count, cleaner_response_bucket_48h_plus_count, cleaner_response_sample_count, time_to_first_offer_bucket_0_15m_count, time_to_first_offer_bucket_15_60m_count, time_to_first_offer_bucket_1_4h_count, time_to_first_offer_bucket_4_12h_count, time_to_first_offer_bucket_12_24h_count, time_to_first_offer_bucket_24_48h_count, time_to_first_offer_bucket_48h_plus_count, time_to_first_offer_sample_count";

export async function loadAssignmentAnalytics24h(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  now: Date = new Date(),
): Promise<AdminAssignmentAnalytics24h> {
  const windowStart = new Date(now.getTime() - 24 * 60 * 60_000);
  const bucketStart = floorToUtcHour(windowStart);
  const bucketEnd = bucketEndExclusive(floorToUtcHour(now));
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
  const allOffersForTouched = mergeOffersByKey([...historyOffers, ...offersCreatedInBucket]);

  const counters = aggregateAssignmentMetricsHourly(
    bucketStart,
    bucketEnd,
    offersCreatedInBucket,
    allOffersForTouched,
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

  const terminal = computeTerminalOfferCount(counters);
  const byPath = buildAssignmentPathMetrics24hFromOffers(
    bucketStart,
    bucketEnd,
    offersCreatedInBucket,
    terminalOffers,
    pathCounters,
    pathByBookingId,
  );

  const latencyBookingIds = [
    ...new Set([
      ...bookingIdsFromCreated,
      ...assignedBookingIds,
    ]),
  ];
  const pendingByBookingId = await fetchFirstPendingAssignmentAuditByBookingIds(
    client,
    latencyBookingIds,
  );
  const latency24h = computeAssignmentLatency24h({
    terminalOffers,
    allOffersForFirstOffer: allOffersForTouched,
    acceptAudits,
    pendingByBookingId,
    bucketStart,
    bucketEnd,
  });

  return {
    offersCreated: counters.offers_created_count,
    offersAccepted: counters.offers_accepted_count,
    offersDeclined: counters.offers_declined_count,
    offersExpired: counters.offers_expired_count,
    offersCancelled: counters.offers_cancelled_count,
    terminalOffers: terminal,
    acceptRatePercent: computeAcceptRatePercent(counters),
    declineRatePercent: computeRatePercent(counters.offers_declined_count, terminal),
    expireRatePercent: computeRatePercent(counters.offers_expired_count, terminal),
    bookingsAssigned: counters.bookings_assigned_count,
    redispatchBookings: counters.redispatch_booking_count,
    maxAttemptsBookings: counters.max_attempts_booking_count,
    adminInterventions: counters.admin_intervention_count,
    byPath,
    latency24h,
  };
}

function mergeOffersByKey<T extends { booking_id: string; offered_at: string }>(
  offers: readonly T[],
): T[] {
  const map = new Map<string, T>();
  for (const offer of offers) {
    map.set(`${offer.booking_id}:${offer.offered_at}`, offer);
  }
  return [...map.values()];
}

async function loadAssignmentMetricsHourlyBuckets(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  now: Date,
): Promise<AssignmentMetricsHourlyBucket[]> {
  const lookbackMs = (24 * 7 + 24 * 7) * 60 * 60_000;
  const since = new Date(now.getTime() - lookbackMs).toISOString();

  const { data, error } = await client
    .from("assignment_metrics_hourly")
    .select(METRICS_HOURLY_SELECT)
    .gte("bucket_start", since)
    .order("bucket_start", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AssignmentMetricsHourlyBucket[];
}

export async function getAdminAssignmentAnalyticsPage(
  user: CurrentUser,
): Promise<
  | { ok: true; page: AdminAssignmentAnalyticsPage }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  try {
    const now = new Date();
    const [live24h, buckets] = await Promise.all([
      loadAssignmentAnalytics24h(client, now),
      loadAssignmentMetricsHourlyBuckets(client, now),
    ]);
    const trends7d = buildAssignmentTrends7d(buckets, now);
    const latencyTrends7d = buildAssignmentLatencyTrends7d(buckets, now);
    return { ok: true, page: { live24h, trends7d, latencyTrends7d } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assignment analytics failed.";
    return { ok: false, code: "PERSISTENCE_ERROR", message, status: 500 };
  }
}
