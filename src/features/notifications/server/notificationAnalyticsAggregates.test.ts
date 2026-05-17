import { describe, expect, it } from "vitest";
import {
  computeQueuePressure,
  computeWorker24hAnalytics,
  type WorkerRunAnalyticsInput,
} from "./notificationAnalyticsAggregates";

describe("computeWorker24hAnalytics", () => {
  it("returns null rates when there are no runs", () => {
    const result = computeWorker24hAnalytics([]);
    expect(result.runCount).toBe(0);
    expect(result.runsOkPercent).toBeNull();
    expect(result.liveSuccessRatePercent).toBeNull();
    expect(result.dryRunRatioPercent).toBeNull();
    expect(result.avgSentPerRun).toBeNull();
  });

  it("excludes dry-run provider runs from live success rate", () => {
    const runs: WorkerRunAnalyticsInput[] = [
      {
        ok: true,
        delivery_enabled: true,
        email_provider: "dry_run",
        reclaimed: 0,
        scanned: 5,
        sent: 5,
        skipped: 0,
        failed: 0,
        dry_run: 5,
      },
      {
        ok: true,
        delivery_enabled: true,
        email_provider: "resend",
        reclaimed: 0,
        scanned: 4,
        sent: 3,
        skipped: 0,
        failed: 1,
        dry_run: 0,
      },
    ];
    const result = computeWorker24hAnalytics(runs);
    expect(result.liveSuccessRatePercent).toBe(75);
    expect(result.sentTotal).toBe(8);
    expect(result.dryRunTotal).toBe(5);
  });

  it("computes dry-run ratio across all delivery outcomes", () => {
    const runs: WorkerRunAnalyticsInput[] = [
      {
        ok: true,
        delivery_enabled: true,
        email_provider: "dry_run",
        reclaimed: 0,
        scanned: 2,
        sent: 0,
        skipped: 0,
        failed: 0,
        dry_run: 2,
      },
    ];
    expect(computeWorker24hAnalytics(runs).dryRunRatioPercent).toBe(100);
  });
});

describe("computeQueuePressure", () => {
  it("marks critical when failed threshold exceeded", () => {
    const result = computeQueuePressure({
      actionablePending: 0,
      processing: 0,
      failed: 5,
      staleProcessing: 0,
    });
    expect(result.level).toBe("critical");
    expect(result.score).toBe(5);
  });

  it("marks elevated when actionable pending is high", () => {
    const result = computeQueuePressure({
      actionablePending: 10,
      processing: 0,
      failed: 0,
      staleProcessing: 0,
    });
    expect(result.level).toBe("elevated");
  });
});
