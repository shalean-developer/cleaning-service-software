import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationOutboxRow } from "@/lib/database/types";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
  PAYSTACK_DECLINED_FAILURE_REASON,
} from "@/features/bookings/server/paymentFailureDisplay";
import { processNotificationOutbox } from "./processNotificationOutbox";
import type { EmailSender } from "./sendEmail";

const reclaimMock = vi.fn(
  async (_client: unknown, _options?: unknown) => ({ reclaimed: 0 }),
);

const loadPaymentFailedContextMock = vi.fn();
const hasSentPaymentFailedMock = vi.fn();

vi.mock("./reclaimStaleProcessingNotifications", () => ({
  reclaimStaleProcessingNotifications: (
    client: unknown,
    options?: unknown,
  ) => reclaimMock(client, options),
}));

vi.mock("./loadPaymentFailedNotificationContext", () => ({
  loadPaymentFailedNotificationContext: (
    client: unknown,
    booking: unknown,
  ) => loadPaymentFailedContextMock(client, booking),
}));

vi.mock("./hasSentPaymentFailedForBooking", () => ({
  hasSentPaymentFailedForBooking: (
    client: unknown,
    bookingId: string,
    excludeOutboxId?: string,
  ) => hasSentPaymentFailedMock(client, bookingId, excludeOutboxId),
}));

function outboxRow(
  overrides: Partial<NotificationOutboxRow> & Pick<NotificationOutboxRow, "id" | "recipient">,
): NotificationOutboxRow {
  const ts = "2026-05-17T10:00:00.000Z";
  return {
    channel: "email",
    payload: { template: "payment_confirmed", bookingId: "booking-1" },
    status: "pending",
    attempts: 0,
    next_retry_at: null,
    last_error: null,
    created_at: ts,
    updated_at: ts,
    ...overrides,
  };
}

type MockDb = {
  outbox: NotificationOutboxRow[];
  bookings: Record<
    string,
    {
      id: string;
      status: string;
      scheduled_start: string;
      scheduled_end: string;
      price_cents: number;
      metadata: object;
    }
  >;
  customers: Record<string, { id: string; profile_id: string }>;
  profiles: Record<string, { full_name: string | null }>;
  authEmails: Record<string, string | undefined>;
};

function createMockClient(db: MockDb): SupabaseClient<Database> {
  const client = {
    from: (table: string) => {
      if (table === "notification_outbox") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                or: () => ({
                  order: () => ({
                    limit: async () => ({ data: [...db.outbox], error: null }),
                  }),
                }),
              }),
            }),
          }),
          update: (patch: Partial<NotificationOutboxRow>) => {
            const applyToRow = (predicate: (row: NotificationOutboxRow) => boolean) => {
              const row = db.outbox.find(predicate);
              if (row) Object.assign(row, patch);
              return row;
            };
            return {
              eq: (col: string, val: string) => {
                if (col !== "id") {
                  return {
                    then: (resolve: (v: { error: null }) => void) =>
                      Promise.resolve(resolve({ error: null })),
                  };
                }
                return {
                  eq: (col2: string, val2: string) => {
                    if (col2 === "status") {
                      return {
                        select: async () => {
                          const row = applyToRow((r) => r.id === val && r.status === val2);
                          return { data: row ? [{ id: row.id }] : [], error: null };
                        },
                      };
                    }
                    return {
                      then: (resolve: (v: { error: null }) => void) =>
                        Promise.resolve(resolve({ error: null })),
                    };
                  },
                  select: async () => {
                    const row = applyToRow((r) => r.id === val);
                    return { data: row ? [{ id: row.id }] : [], error: null };
                  },
                  then: (resolve: (v: { error: null }) => void) => {
                    applyToRow((r) => r.id === val);
                    return Promise.resolve(resolve({ error: null }));
                  },
                };
              },
            };
          },
        };
      }
      if (table === "bookings") {
        return {
          select: () => ({
            eq: (_col: string, bookingId: string) => ({
              maybeSingle: async () => {
                const booking = db.bookings[bookingId];
                return { data: booking ?? null, error: null };
              },
            }),
          }),
        };
      }
      if (table === "customers") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                const customer = db.customers["cust-1"];
                return { data: customer ?? null, error: null };
              },
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                const profile = db.profiles["profile-1"];
                return { data: profile ?? { full_name: "Alex" }, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
    auth: {
      admin: {
        getUserById: async (profileId: string) => ({
          data: { user: { email: db.authEmails[profileId] } },
          error: null,
        }),
      },
    },
  };

  return client as unknown as SupabaseClient<Database>;
}

const defaultFailedBooking = {
  id: "booking-1",
  status: "payment_failed",
  scheduled_start: "2026-06-01T08:00:00.000Z",
  scheduled_end: "2026-06-01T10:00:00.000Z",
  price_cents: 53_000,
  metadata: {},
};

describe("processNotificationOutbox", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    reclaimMock.mockResolvedValue({ reclaimed: 0 });
    loadPaymentFailedContextMock.mockResolvedValue({
      failureReason: null,
      canRetry: false,
    });
    hasSentPaymentFailedMock.mockResolvedValue(false);
    process.env = { ...envBackup };
    process.env.ENABLE_NOTIFICATION_DELIVERY = "true";
    process.env.NOTIFICATION_FROM_EMAIL = "bookings@example.com";
    process.env.RESEND_API_KEY = "re_test";
    process.env.APP_BASE_URL = "https://app.example.com";
    process.env.BOOKING_LOCK_REQUIRED = "true";
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("calls reclaim before delivery batch", async () => {
    const db: MockDb = {
      outbox: [],
      bookings: {},
      customers: {},
      profiles: {},
      authEmails: {},
    };
    const client = createMockClient(db);
    await processNotificationOutbox(client);
    expect(reclaimMock).toHaveBeenCalledOnce();
    expect(reclaimMock).toHaveBeenCalledWith(client, expect.objectContaining({ now: expect.any(Date) }));
  });

  it("no-ops when delivery flag is off without mutating rows", async () => {
    process.env.ENABLE_NOTIFICATION_DELIVERY = "false";
    const db: MockDb = {
      outbox: [outboxRow({ id: "o1", recipient: "cust-1" })],
      bookings: {},
      customers: {},
      profiles: {},
      authEmails: {},
    };
    const client = createMockClient(db);
    const result = await processNotificationOutbox(client);
    expect(result.deliveryEnabled).toBe(false);
    expect(result.scanned).toBe(0);
    expect(db.outbox[0]!.status).toBe("pending");
  });

  it("skips assignment_offer push rows", async () => {
    const db: MockDb = {
      outbox: [
        outboxRow({
          id: "o-offer",
          recipient: "cleaner-1",
          channel: "push",
          payload: { template: "assignment_offer", bookingId: "booking-1" },
        }),
      ],
      bookings: {},
      customers: {},
      profiles: {},
      authEmails: {},
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();
    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.scanned).toBe(0);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("pending");
  });

  it("marks sent on successful payment_confirmed delivery", async () => {
    const db: MockDb = {
      outbox: [outboxRow({ id: "o1", recipient: "cust-1" })],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      profiles: { "profile-1": { full_name: "Alex" } },
      authEmails: { "profile-1": "alex@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async () => ({
      ok: true as const,
      messageId: "msg-1",
    }));

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.sent).toBe(1);
    expect(emailSender).toHaveBeenCalledOnce();
    expect(db.outbox[0]!.status).toBe("sent");
  });

  it("sends payment_failed with checkout_expired copy", async () => {
    loadPaymentFailedContextMock.mockResolvedValue({
      failureReason: CHECKOUT_EXPIRED_FAILURE_REASON,
      canRetry: true,
    });
    const db: MockDb = {
      outbox: [
        outboxRow({
          id: "o-fail",
          recipient: "cust-1",
          payload: { template: "payment_failed", bookingId: "booking-1" },
        }),
      ],
      bookings: { "booking-1": defaultFailedBooking },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      profiles: { "profile-1": { full_name: "Sam" } },
      authEmails: { "profile-1": "sam@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async () => ({
      ok: true as const,
      messageId: "msg-fail",
    }));

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.sent).toBe(1);
    expect(emailSender).toHaveBeenCalledOnce();
    const call = vi.mocked(emailSender).mock.calls[0]![0];
    expect(call.subject).toBe("Your Shalean payment link expired");
    expect(call.text).toContain("retry payment on the same booking");
    expect(db.outbox[0]!.status).toBe("sent");
  });

  it("sends payment_failed with generic copy for paystack_declined", async () => {
    loadPaymentFailedContextMock.mockResolvedValue({
      failureReason: PAYSTACK_DECLINED_FAILURE_REASON,
      canRetry: false,
    });
    const db: MockDb = {
      outbox: [
        outboxRow({
          id: "o-fail",
          recipient: "cust-1",
          payload: { template: "payment_failed", bookingId: "booking-1" },
        }),
      ],
      bookings: { "booking-1": defaultFailedBooking },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      profiles: { "profile-1": { full_name: null } },
      authEmails: { "profile-1": "alex@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async () => ({
      ok: true as const,
      messageId: "msg-fail",
    }));

    await processNotificationOutbox(client, { emailSender });
    const call = vi.mocked(emailSender).mock.calls[0]![0];
    expect(call.subject).toBe("Payment was not completed for your Shalean booking");
    expect(call.text).toContain("start a new booking");
    expect(call.text).not.toContain("retry payment on the same booking");
  });

  it("skips stale payment_failed when booking is no longer payment_failed", async () => {
    const db: MockDb = {
      outbox: [
        outboxRow({
          id: "o-fail",
          recipient: "cust-1",
          payload: { template: "payment_failed", bookingId: "booking-1" },
        }),
      ],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      profiles: { "profile-1": { full_name: "Alex" } },
      authEmails: { "profile-1": "alex@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.skipped).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("failed");
    expect(db.outbox[0]!.last_error).toContain("payment_failed");
  });

  it("does not resend when payment_failed already sent for booking", async () => {
    hasSentPaymentFailedMock.mockResolvedValue(true);
    const db: MockDb = {
      outbox: [
        outboxRow({
          id: "o-dup",
          recipient: "cust-1",
          payload: { template: "payment_failed", bookingId: "booking-1" },
        }),
      ],
      bookings: { "booking-1": defaultFailedBooking },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      profiles: { "profile-1": { full_name: "Alex" } },
      authEmails: { "profile-1": "alex@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.skipped).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("sent");
  });

  it("marks failed when customer has no email", async () => {
    const db: MockDb = {
      outbox: [outboxRow({ id: "o1", recipient: "cust-1" })],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      profiles: { "profile-1": { full_name: null } },
      authEmails: { "profile-1": undefined },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.failed).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("failed");
    expect(db.outbox[0]!.last_error).toContain("email");
  });

  it("records safe error and keeps pending when provider fails retryably", async () => {
    const db: MockDb = {
      outbox: [outboxRow({ id: "o1", recipient: "cust-1" })],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      profiles: { "profile-1": { full_name: "Alex" } },
      authEmails: { "profile-1": "alex@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async () => ({
      ok: false as const,
      error: "rate limit exceeded",
      retryable: true,
    }));

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.failed).toBe(1);
    expect(db.outbox[0]!.status).toBe("pending");
    expect(db.outbox[0]!.attempts).toBe(1);
    expect(db.outbox[0]!.last_error).toContain("rate limit");
    expect(db.outbox[0]!.last_error).not.toContain("@");
  });

  it("continues batch when one row fails", async () => {
    const db: MockDb = {
      outbox: [
        outboxRow({ id: "o-bad", recipient: "cust-missing", payload: { template: "payment_confirmed" } }),
        outboxRow({ id: "o-good", recipient: "cust-1" }),
      ],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      profiles: { "profile-1": { full_name: "Alex" } },
      authEmails: { "profile-1": "alex@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async () => ({
      ok: true as const,
      messageId: "msg-1",
    }));

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.scanned).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });
});
