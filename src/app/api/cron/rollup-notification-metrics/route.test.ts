import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rollupMock = vi.fn();
const backfillMock = vi.fn();
const createServiceRoleClientMock = vi.fn();

vi.mock("@/features/notifications/server/rollupNotificationMetricsHourly", () => ({
  isNotificationMetricsRollupEnabled: () => true,
  rollupNotificationMetricsHourly: (...args: unknown[]) => rollupMock(...args),
  backfillNotificationMetricsHourly: (...args: unknown[]) => backfillMock(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => createServiceRoleClientMock(),
}));

describe("GET /api/cron/rollup-notification-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    createServiceRoleClientMock.mockReturnValue({ id: "service-client" });
    rollupMock.mockResolvedValue({
      bucketStart: "2026-05-17T10:00:00.000Z",
      runCount: 3,
      liveSent: 5,
      liveFailed: 1,
      dryRun: 0,
      upserted: true,
    });
    backfillMock.mockResolvedValue({
      hoursRequested: 2,
      hoursProcessed: 2,
      hoursFailed: 0,
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 without cron secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/rollup-notification-metrics"),
    );
    expect(response.status).toBe(401);
    expect(rollupMock).not.toHaveBeenCalled();
  });

  it("rolls up previous closed hour by default", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/rollup-notification-metrics", {
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.runCount).toBe(3);
    expect(body.liveSent).toBe(5);
    expect(body.upserted).toBe(true);
    expect(rollupMock).toHaveBeenCalledWith(
      { id: "service-client" },
      null,
    );
    expect(JSON.stringify(body)).not.toMatch(/@/);
    expect(body).not.toHaveProperty("errors");
    expect(body).not.toHaveProperty("payload");
  });

  it("accepts bucketStart query param", async () => {
    const { GET } = await import("./route");
    await GET(
      new Request(
        "http://localhost/api/cron/rollup-notification-metrics?bucketStart=2026-05-17T08:00:00.000Z",
        { headers: { authorization: "Bearer cron-test-secret" } },
      ),
    );
    expect(rollupMock).toHaveBeenCalledWith(
      { id: "service-client" },
      "2026-05-17T08:00:00.000Z",
    );
  });

  it("caps backfillHours per request", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/cron/rollup-notification-metrics", {
        method: "POST",
        headers: {
          authorization: "Bearer cron-test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ backfillHours: 999 }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.backfill).toBe(true);
    expect(backfillMock).toHaveBeenCalledWith(
      { id: "service-client" },
      expect.objectContaining({ hours: 24 }),
    );
  });
});
