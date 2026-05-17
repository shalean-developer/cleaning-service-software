import { describe, expect, it, vi } from "vitest";
import {
  aggregateWorkerRunsToHourlyRow,
  backfillNotificationMetricsHourly,
  rollupNotificationMetricsHourly,
  WORKER_RUN_ROLLUP_SELECT,
  type WorkerRunRollupInput,
} from "./rollupNotificationMetricsHourly";
import { floorToUtcHour, previousClosedUtcHour } from "./notificationMetricsHourlyUtc";

describe("aggregateWorkerRunsToHourlyRow", () => {
  const bucketStart = new Date("2026-05-17T10:00:00.000Z");

  it("aggregates counters for a closed hour", () => {
    const runs: WorkerRunRollupInput[] = [
      {
        ok: true,
        delivery_enabled: true,
        email_provider: "resend",
        reclaimed: 1,
        scanned: 5,
        sent: 4,
        skipped: 0,
        failed: 1,
        dry_run: 0,
      },
      {
        ok: false,
        delivery_enabled: true,
        email_provider: "dry_run",
        reclaimed: 0,
        scanned: 2,
        sent: 2,
        skipped: 0,
        failed: 0,
        dry_run: 2,
      },
    ];

    const row = aggregateWorkerRunsToHourlyRow(bucketStart, runs);
    expect(row.run_count).toBe(2);
    expect(row.ok_run_count).toBe(1);
    expect(row.failed_run_count).toBe(1);
    expect(row.sent_count).toBe(6);
    expect(row.dry_run_count).toBe(2);
    expect(row.live_sent_count).toBe(4);
    expect(row.live_failed_count).toBe(1);
    expect(row.dry_run_provider_run_count).toBe(1);
  });

  it("excludes dry_run provider from live counters", () => {
    const runs: WorkerRunRollupInput[] = [
      {
        ok: true,
        delivery_enabled: true,
        email_provider: "dry_run",
        reclaimed: 0,
        scanned: 3,
        sent: 3,
        skipped: 0,
        failed: 0,
        dry_run: 3,
      },
    ];
    const row = aggregateWorkerRunsToHourlyRow(bucketStart, runs);
    expect(row.live_sent_count).toBe(0);
    expect(row.live_failed_count).toBe(0);
    expect(row.dry_run_count).toBe(3);
  });
});

describe("rollupNotificationMetricsHourly", () => {
  const bucketStart = new Date("2026-05-17T10:00:00.000Z");

  it("upserts one hour and is idempotent", async () => {
    const runs = [
      {
        ok: true,
        delivery_enabled: true,
        email_provider: "resend",
        reclaimed: 0,
        scanned: 2,
        sent: 2,
        skipped: 0,
        failed: 0,
        dry_run: 0,
      },
    ];

    const upsertMock = vi.fn(async () => ({ error: null }));
    const selectMock = vi.fn(() => ({
      gte: vi.fn(() => ({
        lt: vi.fn(async () => ({ data: runs, error: null })),
      })),
    }));

    const client = {
      from: vi.fn((table: string) => {
        if (table === "notification_worker_runs") {
          return { select: selectMock };
        }
        if (table === "notification_metrics_hourly") {
          return { upsert: upsertMock };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await rollupNotificationMetricsHourly(
      client as never,
      bucketStart.toISOString(),
      new Date("2026-05-17T12:00:00.000Z"),
    );

    expect(selectMock).toHaveBeenCalledWith(WORKER_RUN_ROLLUP_SELECT);
    expect(result.runCount).toBe(1);
    expect(result.liveSent).toBe(2);
    expect(result.upserted).toBe(true);
    expect(upsertMock).toHaveBeenCalledTimes(1);

    await rollupNotificationMetricsHourly(
      client as never,
      bucketStart.toISOString(),
      new Date("2026-05-17T12:00:00.000Z"),
    );
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ bucket_start: bucketStart.toISOString() }),
      { onConflict: "bucket_start" },
    );
  });

  it("defaults to previous closed UTC hour", async () => {
    const now = new Date("2026-05-17T12:30:00.000Z");
    const expectedBucket = previousClosedUtcHour(now).toISOString();

    const upsertMock = vi.fn(async () => ({ error: null }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === "notification_worker_runs") {
          return {
            select: vi.fn(() => ({
              gte: vi.fn((col: string, start: string) => {
                expect(start).toBe(expectedBucket);
                return {
                  lt: vi.fn(async () => ({ data: [], error: null })),
                };
              }),
            })),
          };
        }
        if (table === "notification_metrics_hourly") {
          return { upsert: upsertMock };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    await rollupNotificationMetricsHourly(client as never, null, now);
    expect(upsertMock).toHaveBeenCalledOnce();
  });

  it("backfills multiple closed hours safely", async () => {
    const upsertMock = vi.fn(async () => ({ error: null }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === "notification_worker_runs") {
          return {
            select: vi.fn(() => ({
              gte: vi.fn(() => ({
                lt: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          };
        }
        if (table === "notification_metrics_hourly") {
          return { upsert: upsertMock };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await backfillNotificationMetricsHourly(client as never, {
      hours: 3,
      now: new Date("2026-05-17T12:00:00.000Z"),
    });

    expect(result.hoursRequested).toBe(3);
    expect(result.hoursProcessed).toBe(3);
    expect(result.hoursFailed).toBe(0);
    expect(upsertMock).toHaveBeenCalledTimes(3);
  });

  it("rejects rolling up the current partial hour", async () => {
    const now = new Date("2026-05-17T12:30:00.000Z");
    const partial = floorToUtcHour(now).toISOString();
    const client = { from: vi.fn() };

    await expect(
      rollupNotificationMetricsHourly(client as never, partial, now),
    ).rejects.toThrow(/partial UTC hour/i);
  });
});
