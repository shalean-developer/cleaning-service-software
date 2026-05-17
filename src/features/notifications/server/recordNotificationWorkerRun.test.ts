import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isNotificationWorkerRunLoggingEnabled,
  parseNotificationWorkerTriggerSource,
  recordNotificationWorkerRun,
  sanitizeWorkerRunErrors,
} from "./recordNotificationWorkerRun";

describe("sanitizeWorkerRunErrors", () => {
  it("strips email-like text and caps message length", () => {
    const long = "x".repeat(300);
    const result = sanitizeWorkerRunErrors([
      {
        outboxId: "00000000-0000-4000-8000-000000000001",
        code: "PROCESS_FAILED",
        message: `Failed for user@example.com ${long}`,
      },
    ]);
    expect(Array.isArray(result)).toBe(true);
    const entry = (result as { message: string }[])[0];
    expect(entry.message).not.toMatch(/@/);
    expect(entry.message.length).toBeLessThanOrEqual(200);
  });

  it("caps error count at 10", () => {
    const errors = Array.from({ length: 12 }, (_, i) => ({
      outboxId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      code: "PROCESS_FAILED",
      message: `err ${i}`,
    }));
    const result = sanitizeWorkerRunErrors(errors);
    expect((result as unknown[]).length).toBe(10);
  });
});

describe("parseNotificationWorkerTriggerSource", () => {
  it("defaults to cron", () => {
    const req = new Request("http://localhost/api/cron/process-notification-outbox");
    expect(parseNotificationWorkerTriggerSource(req)).toBe("cron");
  });

  it("returns manual when header is set", () => {
    const req = new Request("http://localhost/api/cron/process-notification-outbox", {
      headers: { "x-cron-invoke-source": "manual" },
    });
    expect(parseNotificationWorkerTriggerSource(req)).toBe("manual");
  });
});

describe("recordNotificationWorkerRun", () => {
  const insertMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NOTIFICATION_WORKER_RUN_LOGGING;
    insertMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    delete process.env.NOTIFICATION_WORKER_RUN_LOGGING;
  });

  it("is fail-soft when insert fails", async () => {
    insertMock.mockResolvedValue({ error: { code: "XX", message: "insert failed" } });
    const client = {
      from: vi.fn(() => ({ insert: insertMock })),
    };

    await expect(
      recordNotificationWorkerRun(client as never, {
        startedAt: new Date("2026-05-17T12:00:00.000Z"),
        ok: true,
        request: new Request("http://localhost"),
        result: {
          ok: true,
          deliveryEnabled: true,
          emailProvider: "dry_run",
          reclaimed: 0,
          scanned: 1,
          sent: 1,
          skipped: 0,
          dryRun: 0,
          failed: 0,
          errors: [],
          dryRunPreviews: [],
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("skips insert when logging disabled", async () => {
    process.env.NOTIFICATION_WORKER_RUN_LOGGING = "false";
    const client = { from: vi.fn() };

    await recordNotificationWorkerRun(client as never, {
      startedAt: new Date(),
      ok: true,
      request: new Request("http://localhost"),
    });

    expect(client.from).not.toHaveBeenCalled();
  });

  it("persists worker counters without dryRunPreviews", async () => {
    const client = { from: vi.fn(() => ({ insert: insertMock })) };
    const request = new Request("http://localhost", {
      headers: { "x-cron-invoke-source": "manual" },
    });

    await recordNotificationWorkerRun(client as never, {
      startedAt: new Date("2026-05-17T12:00:00.000Z"),
      ok: true,
      request,
      result: {
        ok: true,
        deliveryEnabled: true,
        emailProvider: "dry_run",
        reclaimed: 1,
        scanned: 2,
        sent: 1,
        skipped: 0,
        dryRun: 0,
        failed: 0,
        errors: [],
        dryRunPreviews: [{ outboxId: "x", template: "t", bookingId: "b", offerId: null, recipientType: "customer" }],
      },
    });

    expect(insertMock).toHaveBeenCalledOnce();
    const row = insertMock.mock.calls[0][0];
    expect(row.trigger_source).toBe("manual");
    expect(row.scanned).toBe(2);
    expect(row).not.toHaveProperty("dryRunPreviews");
    expect(JSON.stringify(row)).not.toMatch(/@/);
  });
});

describe("isNotificationWorkerRunLoggingEnabled", () => {
  afterEach(() => {
    delete process.env.NOTIFICATION_WORKER_RUN_LOGGING;
  });

  it("is enabled by default", () => {
    expect(isNotificationWorkerRunLoggingEnabled()).toBe(true);
  });

  it("is disabled when env is false", () => {
    process.env.NOTIFICATION_WORKER_RUN_LOGGING = "false";
    expect(isNotificationWorkerRunLoggingEnabled()).toBe(false);
  });
});
