import { describe, expect, it } from "vitest";
import {
  approximateMedianMinutesFromHistogram,
  approximateMedianMinutesFromLatencyHistogram,
  durationMinutesToBucketIndex,
  durationsToCleanerResponseHistogram,
  durationsToLatencyHistogram,
  durationsToTimeToAssignedHistogram,
  durationsToTimeToFirstOfferHistogram,
  emptyLatencyHistogramCounts,
  mergeCleanerResponseHistogramCounts,
  mergeLatencyHistogramCounts,
  mergeTimeToAssignedHistogramCounts,
  mergeTimeToFirstOfferHistogramCounts,
} from "./assignmentLatencyHistogram";

describe("assignmentLatencyHistogram (7B-1c-b)", () => {
  it("maps duration minutes to bucket indices", () => {
    expect(durationMinutesToBucketIndex(0)).toBe(0);
    expect(durationMinutesToBucketIndex(14.9)).toBe(0);
    expect(durationMinutesToBucketIndex(15)).toBe(1);
    expect(durationMinutesToBucketIndex(59.9)).toBe(1);
    expect(durationMinutesToBucketIndex(60)).toBe(2);
    expect(durationMinutesToBucketIndex(239.9)).toBe(2);
    expect(durationMinutesToBucketIndex(240)).toBe(3);
    expect(durationMinutesToBucketIndex(2880)).toBe(6);
    expect(durationMinutesToBucketIndex(10_000)).toBe(6);
    expect(durationMinutesToBucketIndex(-1)).toBeNull();
  });

  it("builds histogram counts from durations for each metric prefix", () => {
    const durations = [10, 20, 90, 3000];

    const assigned = durationsToTimeToAssignedHistogram(durations);
    expect(assigned.time_to_assigned_sample_count).toBe(4);

    const response = durationsToCleanerResponseHistogram(durations);
    expect(response.cleaner_response_sample_count).toBe(4);

    const firstOffer = durationsToTimeToFirstOfferHistogram(durations);
    expect(firstOffer.time_to_first_offer_sample_count).toBe(4);
  });

  it("merges hourly histogram rows per metric", () => {
    const a = durationsToLatencyHistogram("cleaner_response", [10, 20]);
    const b = durationsToLatencyHistogram("cleaner_response", [90]);
    const merged = mergeCleanerResponseHistogramCounts([a, b]);
    expect(merged.cleaner_response_sample_count).toBe(3);
    expect(merged.cleaner_response_bucket_0_15m_count).toBe(1);
    expect(merged.cleaner_response_bucket_15_60m_count).toBe(1);
    expect(merged.cleaner_response_bucket_1_4h_count).toBe(1);
  });

  it("approximates median from merged histogram using bucket midpoint", () => {
    const counts = emptyLatencyHistogramCounts("time_to_assigned");
    counts.time_to_assigned_bucket_1_4h_count = 9;
    counts.time_to_assigned_bucket_4_12h_count = 1;
    counts.time_to_assigned_sample_count = 10;

    expect(approximateMedianMinutesFromHistogram(counts)).toBe(150);

    const lowResponse = durationsToCleanerResponseHistogram([5]);
    expect(
      approximateMedianMinutesFromLatencyHistogram("cleaner_response", lowResponse),
    ).toBeNull();
  });

  it("returns null approximate median when sample below gate", () => {
    const counts = durationsToTimeToFirstOfferHistogram([10, 20]);
    expect(
      approximateMedianMinutesFromLatencyHistogram("time_to_first_offer", counts),
    ).toBeNull();
  });

  it("keeps time-to-assigned merge helper compatible", () => {
    const merged = mergeTimeToAssignedHistogramCounts([
      durationsToTimeToAssignedHistogram([15]),
      durationsToTimeToAssignedHistogram([45]),
    ]);
    expect(merged.time_to_assigned_sample_count).toBe(2);
    expect(mergeTimeToFirstOfferHistogramCounts).toBeDefined();
    expect(mergeLatencyHistogramCounts("time_to_assigned", [])).toEqual(
      emptyLatencyHistogramCounts("time_to_assigned"),
    );
  });
});
