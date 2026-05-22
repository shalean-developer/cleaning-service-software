import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationOutboxRow } from "@/lib/database/types";
import {
  isDeliverableOutboxRow,
  processNotificationOutbox,
} from "./processNotificationOutbox";
import { buildDeliverableOutboxTemplateOrFilter } from "./config";
import type { EmailSender } from "./sendEmail";

const reclaimMock = vi.fn(async () => ({ reclaimed: 0 }));
const hasSentSupportDedupeMock = vi.fn();

vi.mock("./reclaimStaleProcessingNotifications", () => ({
  reclaimStaleProcessingNotifications: () => reclaimMock(),
}));

vi.mock("./hasSentSupportNotificationForDedupeKey", () => ({
  hasSentSupportNotificationForDedupeKey: (
    _client: unknown,
    dedupeKey: string,
    excludeId?: string,
  ) => hasSentSupportDedupeMock(_client, dedupeKey, excludeId),
}));

function supportOutboxRow(
  overrides: Partial<NotificationOutboxRow> & Pick<NotificationOutboxRow, "id">,
): NotificationOutboxRow {
  const ts = "2026-05-17T10:00:00.000Z";
  return {
    channel: "email",
    recipient: "customer@example.com",
    payload: {
      template: "support_request_created",
      event: "support_request_created",
      dedupeKey: "support_request:booking_support:req-1:open",
      requestId: "req-1",
      source: "booking_support",
      requestType: "general_message",
      requestStatus: "open",
      customerId: "cust-1",
      ctaPath: "/customer/bookings/booking-1#booking-support",
      bookingId: "booking-1",
      subject: "We received your Shalean support request",
      text: "Hi,\n\nThanks",
      html: "<p>Hi</p>",
    },
    status: "pending",
    attempts: 0,
    next_retry_at: null,
    last_error: null,
    created_at: ts,
    updated_at: ts,
    ...overrides,
  };
}

type MockDb = { outbox: NotificationOutboxRow[]; pollNowIso?: string };

function selectDeliverablePendingRows(
  outbox: NotificationOutboxRow[],
  nowIso: string,
  batchSize: number,
): NotificationOutboxRow[] {
  const isRetryDue = (row: NotificationOutboxRow) =>
    row.next_retry_at == null || row.next_retry_at <= nowIso;

  return outbox
    .filter((row) => row.status === "pending" && isRetryDue(row) && isDeliverableOutboxRow(row))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, batchSize);
}

function createMockClient(db: MockDb): SupabaseClient<Database> {
  const sentRows = (channel?: string) =>
    db.outbox.filter((r) => r.status === "sent" && (channel == null || r.channel === channel));

  return {
    from: (table: string) => {
      if (table !== "notification_outbox") throw new Error(`unexpected table ${table}`);

      return {
        select: () => ({
          eq: (col: string, val: string) => {
            if (col === "status" && val === "sent") {
              return {
                eq: (col2: string, val2: string) => ({
                  then: (resolve: (v: { data: NotificationOutboxRow[]; error: null }) => void) =>
                    Promise.resolve(
                      resolve({
                        data: col2 === "channel" ? sentRows(val2) : sentRows(),
                        error: null,
                      }),
                    ),
                }),
                then: (resolve: (v: { data: NotificationOutboxRow[]; error: null }) => void) =>
                  Promise.resolve(resolve({ data: sentRows(), error: null })),
              };
            }
            return {
              or: () => ({
                or: () => ({
                  order: () => ({
                    limit: async (batchSize: number) => ({
                      data: selectDeliverablePendingRows(
                        db.outbox,
                        db.pollNowIso ?? new Date().toISOString(),
                        batchSize,
                      ),
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          },
        }),
        update: (patch: Partial<NotificationOutboxRow>) => {
          const applyToRow = (predicate: (row: NotificationOutboxRow) => boolean) => {
            const row = db.outbox.find(predicate);
            if (row) Object.assign(row, patch);
            return row;
          };
          return {
            eq: (col: string, val: string) => ({
              eq: (col2: string, val2: string) => ({
                select: async () => {
                  const row = applyToRow((r) => r.id === val && r.status === val2);
                  return { data: row ? [{ id: row.id }] : [], error: null };
                },
                then: (resolve: (v: { error: null }) => void) => {
                  applyToRow((r) => r.id === val && r.status === val2);
                  return Promise.resolve(resolve({ error: null }));
                },
              }),
              select: async () => {
                const row = applyToRow((r) => r.id === val);
                return { data: row ? [{ id: row.id }] : [], error: null };
              },
              then: (resolve: (v: { error: null }) => void) => {
                applyToRow((r) => r.id === val);
                return Promise.resolve(resolve({ error: null }));
              },
            }),
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database>;
}

describe("support notification worker delivery", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    hasSentSupportDedupeMock.mockResolvedValue(false);
    process.env = {
      ...envBackup,
      ENABLE_NOTIFICATION_DELIVERY: "true",
      ENABLE_SUPPORT_REQUEST_NOTIFICATIONS: "true",
      NOTIFICATION_FROM_EMAIL: "bookings@example.com",
      RESEND_API_KEY: "re_test",
      APP_BASE_URL: "https://app.example.com",
    };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("registers support templates in deliverable filter", () => {
    const filter = buildDeliverableOutboxTemplateOrFilter();
    expect(filter).toContain("support_request_created");
    expect(filter).toContain("support_request_admin_urgent");
  });

  it("isDeliverableOutboxRow accepts valid support payloads", () => {
    expect(isDeliverableOutboxRow(supportOutboxRow({ id: "o1" }))).toBe(true);
  });

  it("skips customer support delivery when ENABLE_SUPPORT_REQUEST_NOTIFICATIONS is off", async () => {
    process.env.ENABLE_SUPPORT_REQUEST_NOTIFICATIONS = "false";
    const db: MockDb = { outbox: [supportOutboxRow({ id: "o-support" })] };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.skipped).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("pending");
  });

  it("delivers customer support email when flags enabled", async () => {
    const db: MockDb = { outbox: [supportOutboxRow({ id: "o-support" })] };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async () => ({
      ok: true as const,
      messageId: "msg-support",
    }));

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.sent).toBe(1);
    expect(emailSender).toHaveBeenCalledOnce();
    const call = vi.mocked(emailSender).mock.calls[0]![0];
    expect(call.subject).toBe("We received your Shalean support request");
    expect(call.text).toContain("support request status only");
    expect(db.outbox[0]!.status).toBe("sent");
  });

  it("skips admin urgent when NOTIFICATION_SUPPORT_EMAIL missing", async () => {
    process.env.ENABLE_SUPPORT_ADMIN_ALERTS = "true";
    process.env.ENABLE_SUPPORT_REQUEST_NOTIFICATIONS = "false";
    delete process.env.NOTIFICATION_SUPPORT_EMAIL;

    const db: MockDb = {
      outbox: [
        supportOutboxRow({
          id: "o-admin",
          recipient: "admin@internal",
          payload: {
            template: "support_request_admin_urgent",
            event: "support_request_admin_urgent",
            dedupeKey: "support_request:booking_support:req-1:open",
            requestId: "req-1",
            source: "booking_support",
            requestType: "payment_help",
            requestStatus: "open",
            customerId: "cust-1",
            ctaPath: "/customer/bookings/booking-1#booking-support",
            bookingId: "booking-1",
          },
        }),
      ],
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.skipped).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("pending");
  });

  it("delivers admin urgent when admin flags and support email configured", async () => {
    process.env.ENABLE_SUPPORT_ADMIN_ALERTS = "true";
    process.env.ENABLE_SUPPORT_REQUEST_NOTIFICATIONS = "false";
    process.env.NOTIFICATION_SUPPORT_EMAIL = "support@shalean.com";

    const db: MockDb = {
      outbox: [
        supportOutboxRow({
          id: "o-admin",
          recipient: "support@shalean.com",
          payload: {
            template: "support_request_admin_urgent",
            event: "support_request_admin_urgent",
            dedupeKey: "support_request:booking_support:req-1:open",
            requestId: "req-1",
            source: "booking_support",
            requestType: "payment_help",
            requestStatus: "open",
            customerId: "cust-1",
            ctaPath: "/customer/bookings/booking-1#booking-support",
            bookingId: "booking-1",
          },
        }),
      ],
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async () => ({
      ok: true as const,
      messageId: "msg-admin",
    }));

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.sent).toBe(1);
    expect(emailSender).toHaveBeenCalledOnce();
    expect(vi.mocked(emailSender).mock.calls[0]![0].to).toBe("support@shalean.com");
    expect(vi.mocked(emailSender).mock.calls[0]![0].subject).toBe("Urgent Shalean support request");
  });

  it("dedupes support delivery by dedupeKey", async () => {
    hasSentSupportDedupeMock.mockResolvedValue(true);
    const db: MockDb = { outbox: [supportOutboxRow({ id: "o-dedupe" })] };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.skipped).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("sent");
  });
});
