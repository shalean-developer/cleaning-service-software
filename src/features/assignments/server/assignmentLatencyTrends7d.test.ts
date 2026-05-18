import { describe, expect, it } from "vitest";
import { buildAssignmentLatencyTrends7d } from "./assignmentLatencyTrends7d";
import type { AssignmentMetricsHourlyBucket } from "./assignmentTrends7d";

const EMPTY_HISTOGRAM = {
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
} as const;

function bucketWithHistogram(
  bucketStart: string,
  histogram: Partial<AssignmentMetricsHourlyBucket>,
): AssignmentMetricsHourlyBucket {
  return {
    bucket_start: bucketStart,
    offers_created_count: 0,
    offers_accepted_count: 0,
    offers_declined_count: 0,
    offers_expired_count: 0,
    offers_cancelled_count: 0,
    bookings_assigned_count: 0,
    redispatch_booking_count: 0,
    max_attempts_booking_count: 0,
    admin_intervention_count: 0,
    offers_created_selected_count: 0,
    offers_created_best_available_count: 0,
    offers_created_admin_manual_count: 0,
    offers_created_unknown_count: 0,
    offers_accepted_selected_count: 0,
    offers_accepted_best_available_count: 0,
    offers_accepted_admin_manual_count: 0,
    offers_accepted_unknown_count: 0,
    ...EMPTY_HISTOGRAM,
    ...histogram,
  };
}

describe("buildAssignmentLatencyTrends7d (7B-1c-b)", () => {
  const now = new Date("2026-05-18T12:00:00.000Z");

  it("merges 7d histograms and returns approximate medians when n >= 10", () => {
    const trends = buildAssignmentLatencyTrends7d(
      [
        bucketWithHistogram("2026-05-18T10:00:00.000Z", {
          time_to_assigned_bucket_1_4h_count: 6,
          time_to_assigned_sample_count: 6,
          cleaner_response_bucket_15_60m_count: 5,
          cleaner_response_sample_count: 5,
          time_to_first_offer_bucket_0_15m_count: 5,
          time_to_first_offer_sample_count: 5,
        }),
        bucketWithHistogram("2026-05-18T11:00:00.000Z", {
          time_to_assigned_bucket_1_4h_count: 4,
          time_to_assigned_sample_count: 4,
          cleaner_response_bucket_15_60m_count: 5,
          cleaner_response_sample_count: 5,
          time_to_first_offer_bucket_0_15m_count: 5,
          time_to_first_offer_sample_count: 5,
        }),
      ],
      now,
    );

    expect(trends.timeToAssigned.status).toBe("ok");
    expect(trends.timeToAssigned.sampleCount).toBe(10);
    expect(trends.timeToAssigned.approximateMedianMinutes).toBe(150);

    expect(trends.cleanerResponse.status).toBe("ok");
    expect(trends.cleanerResponse.sampleCount).toBe(10);
    expect(trends.cleanerResponse.approximateMedianMinutes).toBe(37.5);

    expect(trends.timeToFirstOffer.status).toBe("ok");
    expect(trends.timeToFirstOffer.sampleCount).toBe(10);
    expect(trends.timeToFirstOffer.approximateMedianMinutes).toBe(7.5);

    const serialized = JSON.stringify(trends);
    expect(serialized).not.toMatch(/bucket_/);
    expect(serialized).not.toMatch(/booking_id/);
  });

  it("returns insufficient_data when merged sample is below 10", () => {
    const trends = buildAssignmentLatencyTrends7d(
      [
        bucketWithHistogram("2026-05-18T10:00:00.000Z", {
          cleaner_response_bucket_0_15m_count: 3,
          cleaner_response_sample_count: 3,
        }),
      ],
      now,
    );

    expect(trends.cleanerResponse.status).toBe("insufficient_data");
    expect(trends.cleanerResponse.approximateMedianMinutes).toBeNull();
  });

  it("surfaces partial coverage note when bucket count is low", () => {
    const trends = buildAssignmentLatencyTrends7d(
      [bucketWithHistogram("2026-05-18T10:00:00.000Z", {})],
      now,
    );

    expect(trends.coverageComplete).toBe(false);
    expect(trends.partialCoverageNote).toMatch(/168/);
  });
});
