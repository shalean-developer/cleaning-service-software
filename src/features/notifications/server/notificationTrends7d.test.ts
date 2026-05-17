import { describe, expect, it } from "vitest";
import {
  computeTrends7dFromHourlyBuckets,
  partitionMetricsBucketsByTrendWindow,
  TRENDS_FULL_COVERAGE_HOURS,
  type NotificationMetricsHourlyBucket,
} from "./notificationTrends7d";

function bucket(
  hourOffsetFromNow: number,
  overrides: Partial<NotificationMetricsHourlyBucket> = {},
): NotificationMetricsHourlyBucket {
  const now = Date.parse("2026-05-17T12:00:00.000Z");
  const bucketStart = new Date(now - hourOffsetFromNow * 60 * 60_000).toISOString();
  return {
    bucket_start: bucketStart,
    run_count: 1,
    sent_count: 10,
    failed_count: 1,
    dry_run_count: 0,
    live_sent_count: 8,
    live_failed_count: 1,
    ...overrides,
  };
}

describe("computeTrends7dFromHourlyBuckets", () => {
  const now = new Date("2026-05-17T12:00:00.000Z");

  it("returns empty-state note when no buckets", () => {
    const trends = computeTrends7dFromHourlyBuckets([], now);
    expect(trends.sent7dTotal).toBe(0);
    expect(trends.partialCoverageNote).toMatch(/No hourly rollup data/i);
    expect(trends.rollupAsOf).toBeNull();
  });

  it("computes 7d vs prior 7d deltas", () => {
    const current = bucket(24, { sent_count: 20, live_sent_count: 18, live_failed_count: 2 });
    const prior = bucket(24 * 8, { sent_count: 10, live_sent_count: 5, live_failed_count: 5 });

    const trends = computeTrends7dFromHourlyBuckets([current, prior], now);
    expect(trends.sent7dTotal).toBe(20);
    expect(trends.sent7dPriorTotal).toBe(10);
    expect(trends.sent7dDeltaPercent).toBe(100);
    expect(trends.liveSuccessRate7dPercent).toBe(90);
    expect(trends.liveSuccessRate7dPriorPercent).toBe(50);
    expect(trends.liveSuccessRate7dDeltaPoints).toBe(40);
  });

  it("flags partial coverage when fewer than 90% of hours present", () => {
    const buckets = [bucket(12, { sent_count: 1 })];
    const trends = computeTrends7dFromHourlyBuckets(buckets, now);
    expect(trends.coverageHours7d).toBe(1);
    expect(trends.coverageComplete).toBe(false);
    expect(trends.partialCoverageNote).toMatch(
      new RegExp(`1 of ${TRENDS_FULL_COVERAGE_HOURS}`),
    );
  });

  it("marks rollup stale when latest bucket is older than 2 hours", () => {
    const stale = bucket(5, { sent_count: 1 });
    const trends = computeTrends7dFromHourlyBuckets([stale], now);
    expect(trends.rollupStale).toBe(true);
  });
});

describe("partitionMetricsBucketsByTrendWindow", () => {
  it("splits buckets into current and prior 7d windows", () => {
    const now = new Date("2026-05-17T12:00:00.000Z");
    const current = bucket(24);
    const prior = bucket(24 * 10);
    const { current7d, prior7d } = partitionMetricsBucketsByTrendWindow([current, prior], now);
    expect(current7d).toHaveLength(1);
    expect(prior7d).toHaveLength(1);
  });
});
