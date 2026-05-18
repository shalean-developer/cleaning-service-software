import { describe, expect, it } from "vitest";
import type { AdminAssignmentAnalytics24h } from "./assignmentAnalyticsReadModel";
import { buildAssignmentPathMetrics24h } from "./assignmentAnalyticsPathDto";
import { emptyAssignmentMetricsPathCounters } from "./assignmentAnalyticsPathMetrics";
import { buildAssignmentTrends7d } from "./assignmentTrends7d";
import { buildAssignmentLatencyTrends7d } from "./assignmentLatencyTrends7d";
import { buildAssignmentLatency24h } from "./assignmentLatencyDto";
import { computeAssignmentLatency24h } from "./assignmentLatencyReadModel";
import type { OfferMetricsInput } from "./assignmentMetricsAggregate";

const FORBIDDEN_DTO_KEYS = [
  "email",
  "recipient",
  "customer",
  "cleaner",
  "payload",
  "booking_id",
  "cleaner_id",
  "customer_id",
];

function assertNoPii(value: unknown, path = ""): void {
  if (value == null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPii(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    expect(FORBIDDEN_DTO_KEYS).not.toContain(key);
    assertNoPii(nested, path ? `${path}.${key}` : key);
  }
}

describe("assignmentAnalyticsReadModel DTO (7B-1a)", () => {
  it("live24h and trends7d shapes contain no PII keys", () => {
    const pathTerminals = {
      selected: 0,
      best_available: 1,
      admin_manual: 0,
      unknown: 0,
    };
    const byPath = buildAssignmentPathMetrics24h(
      {
        ...emptyAssignmentMetricsPathCounters(),
        offers_created_best_available_count: 1,
        offers_accepted_best_available_count: 1,
      },
      pathTerminals,
    );

    const live24h: AdminAssignmentAnalytics24h = {
      offersCreated: 1,
      offersAccepted: 1,
      offersDeclined: 0,
      offersExpired: 0,
      offersCancelled: 0,
      terminalOffers: 1,
      acceptRatePercent: 100,
      declineRatePercent: 0,
      expireRatePercent: null,
      bookingsAssigned: 1,
      redispatchBookings: 0,
      maxAttemptsBookings: 0,
      adminInterventions: 0,
      byPath,
      latency24h: buildAssignmentLatency24h({
        timeToFirstOfferDurations: [],
        cleanerResponseDurations: [],
        timeToAssignedDurations: [],
      }),
    };

    const trends7d = buildAssignmentTrends7d(
      [
        {
          bucket_start: "2026-05-18T10:00:00.000Z",
          offers_created_count: 2,
          offers_accepted_count: 1,
          offers_declined_count: 1,
          offers_expired_count: 0,
          offers_cancelled_count: 0,
          bookings_assigned_count: 1,
          redispatch_booking_count: 0,
          max_attempts_booking_count: 0,
          admin_intervention_count: 0,
          offers_created_selected_count: 1,
          offers_created_best_available_count: 1,
          offers_created_admin_manual_count: 0,
          offers_created_unknown_count: 0,
          offers_accepted_selected_count: 0,
          offers_accepted_best_available_count: 1,
          offers_accepted_admin_manual_count: 0,
          offers_accepted_unknown_count: 0,
          time_to_assigned_bucket_0_15m_count: 0,
          time_to_assigned_bucket_15_60m_count: 0,
          time_to_assigned_bucket_1_4h_count: 0,
          time_to_assigned_bucket_4_12h_count: 0,
          time_to_assigned_bucket_12_24h_count: 0,
          time_to_assigned_bucket_24_48h_count: 0,
          time_to_assigned_bucket_48h_plus_count: 0,
          time_to_assigned_sample_count: 0,
          cleaner_response_bucket_0_15m_count: 0,
          cleaner_response_bucket_15_60m_count: 0,
          cleaner_response_bucket_1_4h_count: 0,
          cleaner_response_bucket_4_12h_count: 0,
          cleaner_response_bucket_12_24h_count: 0,
          cleaner_response_bucket_24_48h_count: 0,
          cleaner_response_bucket_48h_plus_count: 0,
          cleaner_response_sample_count: 0,
          time_to_first_offer_bucket_0_15m_count: 0,
          time_to_first_offer_bucket_15_60m_count: 0,
          time_to_first_offer_bucket_1_4h_count: 0,
          time_to_first_offer_bucket_4_12h_count: 0,
          time_to_first_offer_bucket_12_24h_count: 0,
          time_to_first_offer_bucket_24_48h_count: 0,
          time_to_first_offer_bucket_48h_plus_count: 0,
          time_to_first_offer_sample_count: 0,
        },
      ],
      new Date("2026-05-18T12:00:00.000Z"),
    );

    const latencyTrends7d = buildAssignmentLatencyTrends7d([], new Date("2026-05-18T12:00:00.000Z"));

    assertNoPii({ live24h, trends7d, latencyTrends7d });
    expect(JSON.stringify(latencyTrends7d)).not.toMatch(/bucket_/);
  });

  it("latency DTO exposes aggregates only with no raw timestamps", () => {
    const latency = buildAssignmentLatency24h({
      timeToFirstOfferDurations: Array.from({ length: 10 }, () => 12),
      cleanerResponseDurations: Array.from({ length: 10 }, () => 45),
      timeToAssignedDurations: Array.from({ length: 10 }, () => 90),
    });

    expect(latency.timeToFirstOffer).toEqual({
      medianMinutes: 12,
      sampleSize: 10,
      status: "ok",
    });
    assertNoPii(latency);
    expect(JSON.stringify(latency)).not.toMatch(/T\d{2}:\d{2}:\d{2}/);
  });

  it("computeAssignmentLatency24h keeps 7B funnel metrics independent", () => {
    const bucketStart = new Date("2026-05-17T12:00:00.000Z");
    const bucketEnd = new Date("2026-05-18T12:00:00.000Z");
    const offer: OfferMetricsInput = {
      booking_id: "booking-1",
      status: "accepted",
      offered_at: "2026-05-18T10:00:00.000Z",
      responded_at: "2026-05-18T10:30:00.000Z",
      updated_at: "2026-05-18T10:30:00.000Z",
    };

    const latency = computeAssignmentLatency24h({
      terminalOffers: Array.from({ length: 10 }, () => offer),
      allOffersForFirstOffer: [offer],
      acceptAudits: [{ booking_id: "booking-1", created_at: "2026-05-18T11:00:00.000Z" }],
      pendingByBookingId: new Map([["booking-1", "2026-05-18T09:00:00.000Z"]]),
      bucketStart,
      bucketEnd,
    });

    expect(latency.cleanerResponseTime.sampleSize).toBe(10);
    expect(latency.timeToFirstOffer.status).toBe("insufficient_data");
  });
});
