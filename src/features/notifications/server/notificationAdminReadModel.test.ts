import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const createSupabaseServerClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

const retentionDryRunMock = {
  dryRun: true as const,
  deleted: 0 as const,
  asOf: "2026-05-17T12:00:00.000Z",
  policy: {
    outboxLiveSentDays: 90,
    outboxDryRunSentDays: 60,
    outboxFailedMaxDays: 365,
    outboxUnsupportedPendingDays: 180,
    workerRunsDays: 90,
    metricsMonths: 13,
    requeueShieldDays: 30,
  },
  eligible: {
    outbox: {
      liveSentOlderThanPolicy: 0,
      dryRunSentOlderThanPolicy: 0,
      failedOlderThanPolicy: 0,
      unsupportedPendingOlderThanPolicy: 0,
    },
    workerRuns: {
      olderThanPolicy: 0,
      eligibleWithRollupCoverage: 0,
      protectedMissingRollup: 0,
    },
    metricsHourly: { olderThanPolicy: 0 },
  },
  protected: {
    outbox: {
      pendingDeliverable: 0,
      processing: 0,
      failedWithinRetention: 0,
      requeueShieldRecent: 0,
    },
  },
  oldestEligible: {
    liveSent: null,
    dryRunSent: null,
    failedExpired: null,
    unsupportedPending: null,
    workerRuns: null,
    metricsHourly: null,
  },
};

vi.mock("./reportNotificationRetentionDryRun", () => ({
  reportNotificationRetentionDryRun: vi.fn(async () => retentionDryRunMock),
}));

vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return {
    ...actual,
    canRunNotificationDelivery: () => true,
    isNotificationDeliveryEnabled: () => true,
    getNotificationDeliveryConfig: () => ({
      enabled: true,
      emailProvider: "dry_run" as const,
      providerReady: true,
      fromEmail: "noreply@test.com",
      supportEmail: null,
      appBaseUrl: "https://app.example.com",
    }),
    getProcessingStaleMinutes: () => 15,
  };
});

const adminUser: CurrentUser = {
  profileId: "admin-profile",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

function metricsHourlyFromMock(buckets: unknown[] = []) {
  return {
    select: vi.fn(() => ({
      gte: vi.fn(() => ({
        order: vi.fn(async () => ({ data: buckets, error: null })),
      })),
    })),
  };
}

function workerRunsFromMock(latest: unknown | null, recent: unknown[] = []) {
  const analyticsRuns = recent.length > 0 ? recent : latest ? [latest] : [];
  return {
    select: vi.fn((cols?: string) => {
      if (cols?.includes("errors")) {
        throw new Error("analytics must not select errors");
      }
      return {
        gte: vi.fn(async () => ({ data: analyticsRuns, error: null })),
        order: vi.fn(() => ({
          limit: vi.fn((n: number) => {
            if (n === 1) {
              return {
                maybeSingle: vi.fn(async () => ({ data: latest, error: null })),
              };
            }
            return Promise.resolve({ data: recent, error: null });
          }),
        })),
      };
    }),
  };
}

function chainable(rows: unknown[] | null, count: number | null = null, error: unknown = null) {
  const result = { data: rows, error, count: count ?? rows?.length ?? 0 };
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    not: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: rows?.[0] ?? null, error })),
    then: (
      onFulfilled: (v: typeof result) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

describe("getAdminNotificationHealthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin users", async () => {
    const { getAdminNotificationHealthPage, parseNotificationHealthFilters } = await import(
      "./notificationAdminReadModel"
    );
    const result = await getAdminNotificationHealthPage(
      { ...adminUser, role: "customer" },
      parseNotificationHealthFilters({}),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("returns failed deliverable rows in needs-attention list", async () => {
    const failedRow = {
      id: "fail-1",
      channel: "email",
      recipient: "cust-1",
      payload: { template: "payment_failed", bookingId: "booking-1" },
      status: "failed",
      attempts: 5,
      next_retry_at: null,
      last_error: "Customer has no email address.",
      created_at: "2026-05-17T11:00:00.000Z",
      updated_at: "2026-05-17T11:00:00.000Z",
    };

    const workerRun = {
      id: "run-1",
      started_at: "2026-05-17T11:58:00.000Z",
      completed_at: "2026-05-17T11:59:00.000Z",
      ok: true,
      delivery_enabled: true,
      email_provider: "dry_run",
      trigger_source: "cron",
      reclaimed: 0,
      scanned: 2,
      sent: 1,
      skipped: 0,
      failed: 1,
      dry_run: 0,
      error_count: 1,
      created_at: "2026-05-17T11:59:00.000Z",
    };

    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "notification_worker_runs") {
          return workerRunsFromMock(workerRun, [workerRun]);
        }
        if (table === "notification_metrics_hourly") {
          return metricsHourlyFromMock([
            {
              bucket_start: "2026-05-17T09:00:00.000Z",
              run_count: 2,
              sent_count: 5,
              failed_count: 0,
              dry_run_count: 1,
              live_sent_count: 4,
              live_failed_count: 0,
            },
          ]);
        }
        if (table !== "notification_outbox") return chainable([], 0);
        return {
          select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) return chainable(null, 0);
            return chainable([failedRow]);
          }),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
      }),
    });

    const { getAdminNotificationHealthPage, parseNotificationHealthFilters } = await import(
      "./notificationAdminReadModel"
    );
    const result = await getAdminNotificationHealthPage(
      adminUser,
      parseNotificationHealthFilters({}),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.page.rows.some((r) => r.status === "failed")).toBe(true);
      const failed = result.page.rows.find((r) => r.id === "fail-1");
      expect(failed?.canRequeue).toBe(true);
      const json = JSON.stringify(result.page.rows);
      expect(json).not.toContain("@");
      expect(json).not.toContain("payload");
      expect(result.page.workerHealth.hasRun).toBe(true);
      expect(result.page.workerHealth.scanned).toBe(2);
      expect(JSON.stringify(result.page.workerHealth)).not.toMatch(/@/);
      expect(result.page.recentWorkerRuns).toHaveLength(1);
      expect(result.page.recentWorkerRuns[0]?.scanned).toBe(2);
      expect(result.page.analytics.worker24h.runCount).toBe(1);
      expect(result.page.analytics.worker24h.sentTotal).toBe(1);
      expect(result.page.analytics.queuePressure.score).toBeGreaterThanOrEqual(0);
      expect(result.page.analytics.dryRunModeActive).toBe(true);
      const analyticsJson = JSON.stringify(result.page.analytics);
      expect(analyticsJson).not.toContain("errors");
      expect(analyticsJson).not.toMatch(/@/);
      expect(analyticsJson).not.toContain("payload");
      expect(result.page.analytics.trends7d.sent7dTotal).toBeGreaterThanOrEqual(0);
      expect(result.page.analytics.trends7d.rollupAsOf).toBe("2026-05-17T09:00:00.000Z");
      expect(result.page.retentionDryRun.dryRun).toBe(true);
      expect(result.page.retentionDryRun.deleted).toBe(0);
      const retentionJson = JSON.stringify(result.page.retentionDryRun);
      expect(retentionJson).not.toMatch(/@/);
      expect(retentionJson).not.toContain("recipient");
      expect(retentionJson).not.toContain("payload");
    }
  });

  it("unsupported-only filter does not include deliverable failed rows", async () => {
    const rows = [
      {
        id: "u-1",
        channel: "email",
        recipient: "cust-1",
        payload: { template: "payment_pending", bookingId: "booking-1" },
        status: "pending",
        attempts: 0,
        next_retry_at: null,
        last_error: null,
        created_at: "2026-05-17T11:00:00.000Z",
        updated_at: "2026-05-17T11:00:00.000Z",
      },
    ];

    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "notification_worker_runs") {
          return workerRunsFromMock(null, []);
        }
        if (table === "notification_metrics_hourly") {
          return metricsHourlyFromMock();
        }
        return {
          select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) return chainable(null, 1);
            return chainable(rows);
          }),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
      }),
    });

    const { getAdminNotificationHealthPage, parseNotificationHealthFilters } = await import(
      "./notificationAdminReadModel"
    );
    const result = await getAdminNotificationHealthPage(
      adminUser,
      parseNotificationHealthFilters({ deliverable: "false", status: "pending" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.page.rows.every((r) => !r.isDeliverable)).toBe(true);
      expect(result.page.rows.every((r) => r.status !== "failed")).toBe(true);
      expect(result.page.recentWorkerRuns).toEqual([]);
    }
  });
});

describe("loadLatestNotificationWorkerHealth", () => {
  it("returns unknown health when no runs exist", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(() => workerRunsFromMock(null)),
    });

    const { loadLatestNotificationWorkerHealth } = await import("./notificationAdminReadModel");
    const client = await createSupabaseServerClientMock();
    const health = await loadLatestNotificationWorkerHealth(
      client,
      new Date("2026-05-17T12:00:00.000Z"),
    );
    expect(health.healthLevel).toBe("unknown");
    expect(health.hasRun).toBe(false);
  });
});

describe("loadNotificationAnalytics", () => {
  it("aggregates 24h worker runs without selecting errors", async () => {
    const runs = [
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
        completed_at: "2026-05-17T11:00:00.000Z",
      },
    ];

    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "notification_worker_runs") {
          return {
            select: vi.fn((cols: string) => {
              expect(cols).not.toContain("errors");
              return {
                gte: vi.fn(async () => ({ data: runs, error: null })),
              };
            }),
          };
        }
        if (table === "notification_metrics_hourly") {
          return metricsHourlyFromMock([
            {
              bucket_start: "2026-05-16T10:00:00.000Z",
              run_count: 1,
              sent_count: 10,
              failed_count: 1,
              dry_run_count: 0,
              live_sent_count: 9,
              live_failed_count: 1,
            },
          ]);
        }
        return {
          select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) return chainable(null, 0);
            return chainable([]);
          }),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
      }),
    });

    const { loadNotificationAnalytics } = await import("./notificationAdminReadModel");
    const client = await createSupabaseServerClientMock();
    const summary = {
      sent: 1,
      actionablePending: 0,
      scheduledRetry: 0,
      processing: 0,
      failed: 0,
      staleProcessing: 0,
      unsupportedPending: 0,
      dryRun: 0,
    };
    const analytics = await loadNotificationAnalytics(
      client,
      summary,
      {
        deliveryEnabled: true,
        canRunDelivery: true,
        emailProvider: "resend",
        resendConfigured: true,
        readinessHint: null,
        appBaseUrl: "https://app.example.com",
        appBaseUrlWarning: null,
        staleProcessingMinutes: 15,
      },
      new Date("2026-05-17T12:00:00.000Z"),
    );

    expect(analytics.worker24h.liveSuccessRatePercent).toBe(75);
    expect(analytics.worker24h.runCount).toBe(1);
    expect(analytics.deliverableTemplates).toHaveLength(3);
    expect(analytics.trends7d.sent7dTotal).toBe(10);
    const trendsJson = JSON.stringify(analytics.trends7d);
    expect(trendsJson).not.toContain("errors");
    expect(trendsJson).not.toMatch(/@/);
    expect(trendsJson).not.toContain("payload");
  });
});

describe("loadRecentNotificationWorkerRuns", () => {
  const runA = {
    id: "run-newest-uuid-0001",
    started_at: "2026-05-17T11:58:00.000Z",
    completed_at: "2026-05-17T12:00:00.000Z",
    ok: true,
    delivery_enabled: true,
    email_provider: "dry_run",
    trigger_source: "cron",
    reclaimed: 0,
    scanned: 1,
    sent: 1,
    skipped: 0,
    failed: 0,
    dry_run: 0,
    error_count: 0,
    created_at: "2026-05-17T12:00:00.000Z",
    errors: [{ message: "secret@example.com leaked", outboxId: "x" }],
  };
  const runB = {
    ...runA,
    id: "run-older-uuid-00002",
    completed_at: "2026-05-17T11:50:00.000Z",
    ok: false,
    failed: 2,
    error_count: 2,
  };

  it("loads up to RECENT_WORKER_RUNS_LIMIT runs newest first without errors field", async () => {
    const orderMock = vi.fn(() => ({
      limit: vi.fn(async (n: number) => {
        expect(n).toBe(15);
        return { data: [runA, runB], error: null };
      }),
    }));

    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: orderMock,
        })),
      })),
    });

    const { loadRecentNotificationWorkerRuns } = await import("./notificationAdminReadModel");
    const client = await createSupabaseServerClientMock();
    const runs = await loadRecentNotificationWorkerRuns(
      client,
      new Date("2026-05-17T12:05:00.000Z"),
    );

    expect(orderMock).toHaveBeenCalledWith("completed_at", { ascending: false });
    expect(runs).toHaveLength(2);
    expect(runs[0]?.idShort).toBe("run-newe");
    expect(runs[0]?.statusLabel).toBe("OK");
    expect(runs[1]?.statusLabel).toBe("Failed");
    const json = JSON.stringify(runs);
    expect(json).not.toContain("errors");
    expect(json).not.toMatch(/@/);
  });
});

describe("parseNotificationHealthFilters", () => {
  it("defaults to needs-attention deliverable statuses", async () => {
    const { parseNotificationHealthFilters } = await import("./notificationAdminReadModel");
    const filters = parseNotificationHealthFilters({});
    expect(filters.deliverable).toBe("true");
    expect(filters.status).toEqual(["pending", "processing", "failed"]);
  });
});
