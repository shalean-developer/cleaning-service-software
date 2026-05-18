import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

const verifyCronSecret = vi.fn();
const runBatch = vi.fn();
const recordRun = vi.fn();

vi.mock("@/lib/cron/verifyCronSecret", () => ({
  verifyCronSecret: (...args: unknown[]) => verifyCronSecret(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({}),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => ({}),
}));

vi.mock("@/features/assignments/server/runDeferredAssignmentDispatch", () => ({
  runDeferredAssignmentDispatchBatch: (...args: unknown[]) => runBatch(...args),
}));

vi.mock("@/features/assignments/server/recordDeferredDispatchCronRun", () => ({
  recordDeferredDispatchCronRun: (...args: unknown[]) => recordRun(...args),
}));

describe("dispatch-deferred-assignments cron", () => {
  beforeEach(() => {
    verifyCronSecret.mockReset();
    runBatch.mockReset();
    recordRun.mockReset();
  });

  it("returns 401 without cron secret", async () => {
    verifyCronSecret.mockReturnValue(false);
    const response = await GET(new Request("http://localhost/api/cron/dispatch-deferred-assignments"));
    expect(response.status).toBe(401);
  });

  it("returns structured batch summary on GET", async () => {
    verifyCronSecret.mockReturnValue(true);
    runBatch.mockResolvedValue({
      candidateCount: 2,
      attemptedCount: 2,
      dispatchedBookingIds: ["b1"],
      skippedBookingIds: ["b2"],
      failed: [],
    });

    const response = await GET(
      new Request("http://localhost/api/cron/dispatch-deferred-assignments", {
        headers: { authorization: "Bearer secret" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.dispatchedBookingIds).toEqual(["b1"]);
    expect(body.dispatchedCount).toBe(1);
    expect(body.skippedCount).toBe(1);
    expect(recordRun).toHaveBeenCalled();
  });

  it("POST mirrors GET behavior", async () => {
    verifyCronSecret.mockReturnValue(true);
    runBatch.mockResolvedValue({
      candidateCount: 0,
      attemptedCount: 0,
      dispatchedBookingIds: [],
      skippedBookingIds: [],
      failed: [],
    });

    const response = await POST(
      new Request("http://localhost/api/cron/dispatch-deferred-assignments", {
        method: "POST",
        headers: { authorization: "Bearer secret" },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("records failure but returns 500 when batch throws", async () => {
    verifyCronSecret.mockReturnValue(true);
    runBatch.mockRejectedValue(new Error("batch failed"));

    const response = await GET(
      new Request("http://localhost/api/cron/dispatch-deferred-assignments", {
        headers: { authorization: "Bearer secret" },
      }),
    );
    expect(response.status).toBe(500);
    expect(recordRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ok: false }),
    );
  });
});
