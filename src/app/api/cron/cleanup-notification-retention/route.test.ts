import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reportMock = vi.fn();
const createServiceRoleClientMock = vi.fn();

vi.mock("@/features/notifications/server/reportNotificationRetentionDryRun", () => ({
  reportNotificationRetentionDryRun: (...args: unknown[]) => reportMock(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => createServiceRoleClientMock(),
}));

const sampleReport = {
  dryRun: true,
  deleted: 0,
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
      liveSentOlderThanPolicy: 1,
      dryRunSentOlderThanPolicy: 0,
      failedOlderThanPolicy: 0,
      unsupportedPendingOlderThanPolicy: 2,
    },
    workerRuns: {
      olderThanPolicy: 3,
      eligibleWithRollupCoverage: 2,
      protectedMissingRollup: 1,
    },
    metricsHourly: { olderThanPolicy: 0 },
  },
  protected: {
    outbox: {
      pendingDeliverable: 4,
      processing: 1,
      failedWithinRetention: 2,
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

describe("GET /api/cron/cleanup-notification-retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    createServiceRoleClientMock.mockReturnValue({ id: "service-client" });
    reportMock.mockResolvedValue(sampleReport);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 without cron secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/cleanup-notification-retention"),
    );
    expect(response.status).toBe(401);
    expect(reportMock).not.toHaveBeenCalled();
  });

  it("returns counts only with dryRun true and deleted 0", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/cleanup-notification-retention", {
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(body.deleted).toBe(0);
    expect(body.eligible.outbox.liveSentOlderThanPolicy).toBe(1);
    expect(reportMock).toHaveBeenCalledWith({ id: "service-client" });
    expect(JSON.stringify(body)).not.toMatch(/@/);
    expect(body).not.toHaveProperty("recipient");
    expect(body).not.toHaveProperty("payload");

    const logLine = warnSpy.mock.calls.find((call) =>
      String(call[0]).includes("notification_retention_dry_run"),
    );
    expect(logLine).toBeDefined();
    const logged = JSON.parse(String(logLine![0]));
    expect(logged.deleted).toBe(0);
    expect(logged.dryRun).toBe(true);
    expect(logged.eligible.outbox.liveSentOlderThanPolicy).toBe(1);

    warnSpy.mockRestore();
  });
});
