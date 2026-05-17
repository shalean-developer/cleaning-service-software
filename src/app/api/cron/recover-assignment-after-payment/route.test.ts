import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/cron/verifyCronSecret", () => ({
  verifyCronSecret: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: vi.fn(() => ({})),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: vi.fn(() => ({})),
}));

const runBatch = vi.fn();

vi.mock("@/features/assignments/server/runAssignmentRecovery", () => ({
  runAssignmentRecoveryBatch: (...args: unknown[]) => runBatch(...args),
}));

describe("recover-assignment-after-payment cron route", () => {
  it("returns recovery batch summary when authorized", async () => {
    runBatch.mockResolvedValue({
      candidateCount: 1,
      attemptedCount: 1,
      recoveredBookingIds: ["b1"],
      skippedBookingIds: [],
      failed: [],
    });

    const response = await GET(
      new Request("http://localhost/api/cron/recover-assignment-after-payment", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.recoveredBookingIds).toEqual(["b1"]);
  });
});
