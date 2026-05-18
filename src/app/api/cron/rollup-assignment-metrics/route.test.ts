import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rollupMock = vi.fn();
const backfillMock = vi.fn();
const createServiceRoleClientMock = vi.fn();

vi.mock("@/features/assignments/server/rollupAssignmentMetricsHourly", () => ({
  isAssignmentMetricsRollupEnabled: () => true,
  rollupAssignmentMetricsHourly: (...args: unknown[]) => rollupMock(...args),
  backfillAssignmentMetricsHourly: (...args: unknown[]) => backfillMock(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => createServiceRoleClientMock(),
}));

describe("GET /api/cron/rollup-assignment-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    createServiceRoleClientMock.mockReturnValue({ id: "service-client" });
    rollupMock.mockResolvedValue({
      bucketStart: "2026-05-18T10:00:00.000Z",
      offersCreated: 4,
      offersAccepted: 2,
      bookingsAssigned: 2,
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
      new Request("http://localhost/api/cron/rollup-assignment-metrics"),
    );
    expect(response.status).toBe(401);
    expect(rollupMock).not.toHaveBeenCalled();
  });

  it("rolls up previous closed hour by default", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/rollup-assignment-metrics", {
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.offersCreated).toBe(4);
    expect(body.upserted).toBe(true);
    expect(rollupMock).toHaveBeenCalledWith({ id: "service-client" }, null);
    expect(JSON.stringify(body)).not.toMatch(/@/);
    expect(body).not.toHaveProperty("bookingId");
    expect(body).not.toHaveProperty("cleanerId");
  });
});
