import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processMock = vi.fn();
const createServiceRoleClientMock = vi.fn();

vi.mock("@/features/notifications/server/processNotificationOutbox", () => ({
  processNotificationOutbox: (...args: unknown[]) => processMock(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => createServiceRoleClientMock(),
}));

describe("GET /api/cron/process-notification-outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    createServiceRoleClientMock.mockReturnValue({});
    processMock.mockResolvedValue({
      ok: true,
      deliveryEnabled: true,
      reclaimed: 0,
      scanned: 2,
      sent: 1,
      skipped: 0,
      failed: 1,
      errors: [{ outboxId: "o1", code: "PROCESS_FAILED", message: "Row processing failed." }],
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
  });

  it("runs outbox processor with valid bearer secret", async () => {
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
    expect(body).not.toHaveProperty("email");
    expect(processMock).toHaveBeenCalledOnce();
  });
});
