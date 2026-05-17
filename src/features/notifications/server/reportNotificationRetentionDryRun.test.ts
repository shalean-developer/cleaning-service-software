import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

function countChainable(count: number) {
  const builder = {
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    not: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (
      onFulfilled: (v: { count: number | null; error: null }) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve({ count, error: null }).then(onFulfilled, onRejected),
  };
  return builder;
}

function selectChainable(data: unknown[] = []) {
  const builder = {
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(async () => ({ data, error: null })),
    not: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    or: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: data[0] ?? null, error: null })),
  };
  return builder;
}

describe("reportNotificationRetentionDryRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NOTIFICATION_RETENTION_OUTBOX_SENT_DAYS;
  });

  it("returns dry-run report with deleted 0 and no PII fields", async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === "admin_operational_audit") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    limit: vi.fn(async () => ({ data: [], error: null })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "notification_metrics_hourly") {
          const metricsOldestChain = {
            lt: vi.fn(() => metricsOldestChain),
            order: vi.fn(() => metricsOldestChain),
            limit: vi.fn(() => metricsOldestChain),
            maybeSingle: vi.fn(async () => ({
              data: { bucket_start: "2025-01-01T00:00:00.000Z" },
              error: null,
            })),
          };
          const metricsBucketList = {
            lt: vi.fn(() => metricsOldestChain),
            then: (
              onFulfilled: (v: { data: { bucket_start: string }[]; error: null }) => unknown,
              onRejected?: (e: unknown) => unknown,
            ) =>
              Promise.resolve({
                data: [{ bucket_start: "2025-12-31T10:00:00.000Z" }],
                error: null,
              }).then(onFulfilled, onRejected),
          };
          return {
            select: vi.fn((cols?: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.head) return countChainable(2);
              if (cols === "bucket_start") return metricsBucketList;
              return metricsBucketList;
            }),
          };
        }
        if (table === "notification_worker_runs") {
          return {
            select: vi.fn((cols?: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.head) return countChainable(3);
              if (cols === "completed_at") {
                const completedAtChain = {
                  lt: vi.fn(() => completedAtChain),
                  order: vi.fn(() => completedAtChain),
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { completed_at: "2025-02-01T00:00:00.000Z" },
                      error: null,
                    })),
                  })),
                  range: vi.fn(async () => ({
                    data: [
                      { completed_at: "2025-12-31T10:15:00.000Z" },
                      { completed_at: "2025-12-31T12:15:00.000Z" },
                    ],
                    error: null,
                  })),
                };
                return completedAtChain;
              }
            }),
          };
        }
        if (table === "notification_outbox") {
          const oldestChain = {
            eq: vi.fn(() => oldestChain),
            lt: vi.fn(() => oldestChain),
            not: vi.fn(() => oldestChain),
            ilike: vi.fn(() => oldestChain),
            or: vi.fn(() => oldestChain),
            in: vi.fn(() => oldestChain),
            order: vi.fn(() => oldestChain),
            limit: vi.fn(() => oldestChain),
            maybeSingle: vi.fn(async () => ({
              data: { updated_at: "2025-01-01T00:00:00.000Z", created_at: "2025-01-01T00:00:00.000Z" },
              error: null,
            })),
          };
          return {
            select: vi.fn((_cols?: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.head) return countChainable(1);
              if (_cols === "updated_at" || _cols === "created_at") return oldestChain;
              return selectChainable([{ updated_at: "2025-01-01T00:00:00.000Z" }]);
            }),
          };
        }
        return countChainable(0);
      }),
    };

    const { reportNotificationRetentionDryRun } = await import(
      "./reportNotificationRetentionDryRun"
    );
    const report = await reportNotificationRetentionDryRun(
      client as never,
      new Date("2026-05-17T12:00:00.000Z"),
    );

    expect(report.dryRun).toBe(true);
    expect(report.deleted).toBe(0);
    expect(report.policy.outboxLiveSentDays).toBe(90);
    expect(report.eligible.workerRuns.eligibleWithRollupCoverage).toBe(1);
    expect(report.eligible.workerRuns.protectedMissingRollup).toBe(1);

    const json = JSON.stringify(report);
    expect(json).not.toMatch(/@/);
    expect(json).not.toContain("recipient");
    expect(json).not.toContain("payload");
    expect(json).not.toContain("errors");
  });

  it("source module does not call delete or update", () => {
    const filePath = path.join(
      process.cwd(),
      "src/features/notifications/server/reportNotificationRetentionDryRun.ts",
    );
    const source = fs.readFileSync(filePath, "utf8");
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
  });
});
