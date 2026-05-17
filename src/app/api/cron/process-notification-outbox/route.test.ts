import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processMock = vi.fn();
const createServiceRoleClientMock = vi.fn();
const recordWorkerRunMock = vi.fn();

vi.mock("@/features/notifications/server/processNotificationOutbox", () => ({
  processNotificationOutbox: (...args: unknown[]) => processMock(...args),
}));

vi.mock("@/features/notifications/server/recordNotificationWorkerRun", () => ({
  recordNotificationWorkerRun: (...args: unknown[]) => recordWorkerRunMock(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => createServiceRoleClientMock(),
}));

describe("GET /api/cron/process-notification-outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    createServiceRoleClientMock.mockReturnValue({ id: "service-client" });
    recordWorkerRunMock.mockResolvedValue(undefined);
    processMock.mockResolvedValue({
      ok: true,
      deliveryEnabled: true,
      emailProvider: "dry_run",
      reclaimed: 0,
      scanned: 2,
      sent: 1,
      skipped: 0,
      dryRun: 0,
      failed: 1,
      errors: [{ outboxId: "o1", code: "PROCESS_FAILED", message: "Row processing failed." }],
      dryRunPreviews: [
        {
          outboxId: "o1",
          template: "payment_confirmed",
          bookingId: "booking-1",
          offerId: null,
          recipientType: "customer",
        },
      ],
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 without cron secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/process-notification-outbox"),
    );
    expect(response.status).toBe(401);
    expect(processMock).not.toHaveBeenCalled();
    expect(recordWorkerRunMock).not.toHaveBeenCalled();
  });

  it("runs outbox processor and records worker run with valid bearer secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/process-notification-outbox", {
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(1);
    expect(body.scanned).toBe(2);
    expect(body.emailProvider).toBe("dry_run");
    expect(body.dryRunPreviews).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/@/);
    expect(body).not.toHaveProperty("email");
    expect(processMock).toHaveBeenCalledOnce();
    expect(recordWorkerRunMock).toHaveBeenCalledOnce();
    expect(recordWorkerRunMock.mock.calls[0][1]).toMatchObject({ ok: true });
  });

  it("still returns worker result when run logging fails", async () => {
    recordWorkerRunMock.mockRejectedValue(new Error("persist failed"));
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/process-notification-outbox", {
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).sent).toBe(1);
  });

  it("records failed run and returns 500 when worker throws", async () => {
    processMock.mockRejectedValue(new Error("worker exploded"));
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/cron/process-notification-outbox", {
        headers: {
          authorization: "Bearer cron-test-secret",
          "x-cron-invoke-source": "manual",
        },
      }),
    );
    expect(response.status).toBe(500);
    expect(recordWorkerRunMock).toHaveBeenCalledOnce();
    expect(recordWorkerRunMock.mock.calls[0][1]).toMatchObject({ ok: false });
  });
});
