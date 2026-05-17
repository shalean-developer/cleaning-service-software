import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationOutboxRow } from "@/lib/database/types";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
  PAYSTACK_DECLINED_FAILURE_REASON,
} from "@/features/bookings/server/paymentFailureDisplay";
import { buildDeliverableOutboxTemplateOrFilter } from "./config";
import {
  isDeliverableOutboxRow,
  processNotificationOutbox,
} from "./processNotificationOutbox";
import type { EmailSender } from "./sendEmail";

const reclaimMock = vi.fn(
  async (_client: unknown, _options?: unknown) => ({ reclaimed: 0 }),
);

const loadPaymentFailedContextMock = vi.fn();
const hasSentPaymentFailedMock = vi.fn();
const hasSentPaymentConfirmedMock = vi.fn();
const hasSentAssignmentOfferMock = vi.fn();

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

vi.mock("./hasSentPaymentConfirmedForBooking", () => ({
  hasSentPaymentConfirmedForBooking: (
    client: unknown,
    bookingId: string,
    excludeOutboxId?: string,
  ) => hasSentPaymentConfirmedMock(client, bookingId, excludeOutboxId),
}));

vi.mock("./hasSentAssignmentOfferForOffer", () => ({
  hasSentAssignmentOfferForOffer: (
    client: unknown,
    offerId: string,
    excludeOutboxId?: string,
  ) => hasSentAssignmentOfferMock(client, offerId, excludeOutboxId),
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

type MockBooking = {
  id: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  price_cents: number;
  currency: string;
  metadata: object;
  cleaner_id: string | null;
};

type MockOffer = {
  id: string;
  booking_id: string;
  cleaner_id: string;
  status: string;
  expires_at: string | null;
  offered_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

type MockDb = {
  outbox: NotificationOutboxRow[];
  bookings: Record<string, MockBooking>;
  customers: Record<string, { id: string; profile_id: string }>;
  cleaners: Record<string, { id: string; profile_id: string }>;
  assignment_offers: Record<string, MockOffer>;
  profiles: Record<string, { full_name: string | null }>;
  authEmails: Record<string, string | undefined>;
  /** ISO timestamp used when simulating deliverable poll (defaults to current time). */
  pollNowIso?: string;
};

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
  const client = {
    from: (table: string) => {
      if (table === "notification_outbox") {
        const sentRows = (channel?: string) =>
          db.outbox.filter(
            (r) => r.status === "sent" && (channel == null || r.channel === channel),
          );

        return {
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === "status" && val === "sent") {
                const chain = {
                  eq: (col2: string, val2: string) => ({
                    then: (resolve: (v: { data: typeof db.outbox; error: null }) => void) =>
                      Promise.resolve(
                        resolve({
                          data: col2 === "channel" ? sentRows(val2) : sentRows(),
                          error: null,
                        }),
                      ),
                  }),
                  then: (resolve: (v: { data: typeof db.outbox; error: null }) => void) =>
                    Promise.resolve(resolve({ data: sentRows(), error: null })),
                };
                return chain;
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
                        then: (resolve: (v: { error: null }) => void) => {
                          applyToRow((r) => r.id === val && r.status === val2);
                          return Promise.resolve(resolve({ error: null }));
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
      if (table === "assignment_offers") {
        return {
          select: () => ({
            eq: (_col: string, offerId: string) => ({
              maybeSingle: async () => {
                const offer = db.assignment_offers[offerId];
                return { data: offer ?? null, error: null };
              },
            }),
          }),
        };
      }
      if (table === "customers") {
        return {
          select: () => ({
            eq: (_col: string, customerId: string) => ({
              maybeSingle: async () => {
                const customer = db.customers[customerId];
                return { data: customer ?? null, error: null };
              },
            }),
          }),
        };
      }
      if (table === "cleaners") {
        return {
          select: () => ({
            eq: (_col: string, cleanerId: string) => ({
              maybeSingle: async () => {
                const cleaner = db.cleaners[cleanerId];
                return { data: cleaner ?? null, error: null };
              },
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (_col: string, profileId: string) => ({
              maybeSingle: async () => {
                const profile = db.profiles[profileId];
                return { data: profile ?? { full_name: null }, error: null };
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

const defaultFailedBooking: MockBooking = {
  id: "booking-1",
  status: "payment_failed",
  scheduled_start: "2026-06-01T08:00:00.000Z",
  scheduled_end: "2026-06-01T10:00:00.000Z",
  price_cents: 53_000,
  currency: "ZAR",
  metadata: {},
  cleaner_id: null,
};

const defaultOfferBooking: MockBooking = {
  id: "booking-offer-1",
  status: "pending_assignment",
  scheduled_start: "2026-06-01T08:00:00.000Z",
  scheduled_end: "2026-06-01T10:00:00.000Z",
  price_cents: 53_000,
  currency: "ZAR",
  metadata: {
    suburb: "Sea Point",
    city: "Cape Town",
    quote: {
      input: { serviceSlug: "regular-cleaning", teamSize: 1 },
      cleanerEarningsPreview: { perCleanerAmountCents: 45_000 },
    },
  },
  cleaner_id: null,
};

function offerOutboxRow(
  overrides: Partial<NotificationOutboxRow> & Pick<NotificationOutboxRow, "id" | "recipient">,
): NotificationOutboxRow {
  return outboxRow({
    channel: "push",
    payload: {
      template: "assignment_offer",
      bookingId: "booking-offer-1",
      offerId: "offer-1",
    },
    ...overrides,
  });
}

function defaultOpenOffer(overrides: Partial<MockOffer> = {}): MockOffer {
  return {
    id: "offer-1",
    booking_id: "booking-offer-1",
    cleaner_id: "cleaner-1",
    status: "offered",
    expires_at: "2099-06-03T10:00:00.000Z",
    offered_at: "2026-06-01T10:00:00.000Z",
    responded_at: null,
    created_at: "2026-06-01T10:00:00.000Z",
    updated_at: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildDeliverableOutboxTemplateOrFilter", () => {
  it("includes email payment templates and push assignment_offer", () => {
    const filter = buildDeliverableOutboxTemplateOrFilter();
    expect(filter).toContain("channel.eq.email");
    expect(filter).toContain("payment_confirmed");
    expect(filter).toContain("payment_failed");
    expect(filter).toContain("channel.eq.push");
    expect(filter).toContain("assignment_offer");
  });
});

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
    hasSentPaymentConfirmedMock.mockResolvedValue(false);
    hasSentAssignmentOfferMock.mockResolvedValue(false);
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
      cleaners: {},
      assignment_offers: {},
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
      cleaners: {},
      assignment_offers: {},
      profiles: {},
      authEmails: {},
    };
    const client = createMockClient(db);
    const result = await processNotificationOutbox(client);
    expect(result.deliveryEnabled).toBe(false);
    expect(result.scanned).toBe(0);
    expect(db.outbox[0]!.status).toBe("pending");
  });

  it("delivers assignment_offer push rows as email when offer is open", async () => {
    const db: MockDb = {
      outbox: [offerOutboxRow({ id: "o-offer", recipient: "cleaner-1" })],
      bookings: { "booking-offer-1": defaultOfferBooking },
      assignment_offers: { "offer-1": defaultOpenOffer() },
      cleaners: { "cleaner-1": { id: "cleaner-1", profile_id: "profile-c1" } },
      customers: {},
      profiles: { "profile-c1": { full_name: "Jordan" } },
      authEmails: { "profile-c1": "jordan@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async () => ({
      ok: true as const,
      messageId: "msg-offer",
    }));

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.sent).toBe(1);
    expect(emailSender).toHaveBeenCalledOnce();
    const call = vi.mocked(emailSender).mock.calls[0]![0];
    expect(call.subject).toBe("New Shalean cleaning job offer");
    expect(call.text).toContain("/cleaner/offers");
    expect(call.text).not.toContain("/accept");
    expect(db.outbox[0]!.status).toBe("sent");
  });

  it("skips cancelled assignment_offer without sending", async () => {
    const db: MockDb = {
      outbox: [offerOutboxRow({ id: "o-offer", recipient: "cleaner-1" })],
      bookings: { "booking-offer-1": defaultOfferBooking },
      assignment_offers: { "offer-1": defaultOpenOffer({ status: "cancelled" }) },
      cleaners: { "cleaner-1": { id: "cleaner-1", profile_id: "profile-c1" } },
      customers: {},
      profiles: {},
      authEmails: {},
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.skipped).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("sent");
  });

  it("skips expired assignment_offer without sending", async () => {
    const db: MockDb = {
      outbox: [offerOutboxRow({ id: "o-offer", recipient: "cleaner-1" })],
      bookings: { "booking-offer-1": defaultOfferBooking },
      assignment_offers: {
        "offer-1": defaultOpenOffer({ expires_at: "2020-01-01T00:00:00.000Z" }),
      },
      cleaners: { "cleaner-1": { id: "cleaner-1", profile_id: "profile-c1" } },
      customers: {},
      profiles: {},
      authEmails: {},
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.skipped).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("sent");
  });

  it("skips assignment_offer when booking is no longer pending_assignment", async () => {
    const db: MockDb = {
      outbox: [offerOutboxRow({ id: "o-offer", recipient: "cleaner-1" })],
      bookings: {
        "booking-offer-1": { ...defaultOfferBooking, status: "assigned", cleaner_id: "cleaner-1" },
      },
      assignment_offers: { "offer-1": defaultOpenOffer() },
      cleaners: { "cleaner-1": { id: "cleaner-1", profile_id: "profile-c1" } },
      customers: {},
      profiles: {},
      authEmails: {},
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.skipped).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("sent");
  });

  it("does not resend when assignment_offer already sent for offerId", async () => {
    hasSentAssignmentOfferMock.mockResolvedValue(true);
    const db: MockDb = {
      outbox: [offerOutboxRow({ id: "o-dup", recipient: "cleaner-1" })],
      bookings: { "booking-offer-1": defaultOfferBooking },
      assignment_offers: { "offer-1": defaultOpenOffer() },
      cleaners: { "cleaner-1": { id: "cleaner-1", profile_id: "profile-c1" } },
      customers: {},
      profiles: { "profile-c1": { full_name: "Jordan" } },
      authEmails: { "profile-c1": "jordan@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.skipped).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("sent");
  });

  it("marks failed when cleaner has no email", async () => {
    const db: MockDb = {
      outbox: [offerOutboxRow({ id: "o-offer", recipient: "cleaner-1" })],
      bookings: { "booking-offer-1": defaultOfferBooking },
      assignment_offers: { "offer-1": defaultOpenOffer() },
      cleaners: { "cleaner-1": { id: "cleaner-1", profile_id: "profile-c1" } },
      customers: {},
      profiles: { "profile-c1": { full_name: null } },
      authEmails: { "profile-c1": undefined },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.failed).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("failed");
    expect(db.outbox[0]!.last_error).toContain("email");
  });

  it("delivers assignment_offer when many unsupported pending rows are older", async () => {
    const oldTs = "2020-01-01T00:00:00.000Z";
    const offerTs = "2026-05-17T12:00:00.000Z";
    const unsupportedRows = Array.from({ length: 200 }, (_, i) =>
      outboxRow({
        id: `o-draft-${i}`,
        recipient: "cust-1",
        created_at: oldTs,
        updated_at: oldTs,
        payload: { template: "booking_draft_created", bookingId: "booking-1" },
      }),
    );
    const db: MockDb = {
      outbox: [
        ...unsupportedRows,
        offerOutboxRow({
          id: "o-offer-reachable",
          recipient: "cleaner-1",
          created_at: offerTs,
          updated_at: offerTs,
        }),
      ],
      bookings: { "booking-offer-1": defaultOfferBooking },
      assignment_offers: { "offer-1": defaultOpenOffer() },
      cleaners: { "cleaner-1": { id: "cleaner-1", profile_id: "profile-c1" } },
      customers: {},
      profiles: { "profile-c1": { full_name: "Jordan" } },
      authEmails: { "profile-c1": "jordan@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async () => ({
      ok: true as const,
      messageId: "msg-offer",
    }));

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.sent).toBe(1);
    expect(result.scanned).toBe(1);
    expect(emailSender).toHaveBeenCalledOnce();
    expect(db.outbox.find((r) => r.id === "o-offer-reachable")!.status).toBe("sent");
    for (const row of unsupportedRows) {
      expect(row.status).toBe("pending");
    }
  });

  it("still selects payment_confirmed and payment_failed behind unsupported rows", async () => {
    const oldTs = "2020-01-01T00:00:00.000Z";
    const recentTs = "2026-05-17T12:00:00.000Z";
    const db: MockDb = {
      outbox: [
        outboxRow({
          id: "o-draft",
          recipient: "cust-1",
          created_at: oldTs,
          updated_at: oldTs,
          payload: { template: "booking_draft_created", bookingId: "booking-1" },
        }),
        outboxRow({
          id: "o-confirmed",
          recipient: "cust-1",
          created_at: recentTs,
          updated_at: recentTs,
          payload: { template: "payment_confirmed", bookingId: "booking-1" },
        }),
        outboxRow({
          id: "o-failed",
          recipient: "cust-1",
          created_at: recentTs,
          updated_at: recentTs,
          payload: { template: "payment_failed", bookingId: "booking-2" },
        }),
      ],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
        "booking-2": defaultFailedBooking,
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      cleaners: {},
      assignment_offers: {},
      profiles: { "profile-1": { full_name: "Alex" } },
      authEmails: { "profile-1": "alex@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async () => ({
      ok: true as const,
      messageId: "msg",
    }));

    const result = await processNotificationOutbox(client, { emailSender, batchSize: 10 });
    expect(result.scanned).toBe(2);
    expect(result.sent).toBe(2);
    expect(db.outbox.find((r) => r.id === "o-draft")!.status).toBe("pending");
  });

  it("leaves unsupported email templates pending", async () => {
    const db: MockDb = {
      outbox: [
        outboxRow({
          id: "o-pending-pay",
          recipient: "cust-1",
          payload: { template: "payment_pending", bookingId: "booking-1" },
        }),
        outboxRow({
          id: "o-cleaner-assigned",
          recipient: "cust-1",
          payload: { template: "cleaner_assigned", bookingId: "booking-1" },
        }),
      ],
      bookings: {},
      customers: {},
      cleaners: {},
      assignment_offers: {},
      profiles: {},
      authEmails: {},
    };
    const client = createMockClient(db);
    const result = await processNotificationOutbox(client);
    expect(result.scanned).toBe(0);
    expect(db.outbox.every((r) => r.status === "pending")).toBe(true);
  });

  it("skips pending rows with future next_retry_at", async () => {
    const db: MockDb = {
      pollNowIso: "2026-05-17T10:00:00.000Z",
      outbox: [
        outboxRow({
          id: "o-retry-later",
          recipient: "cust-1",
          next_retry_at: "2026-05-17T11:00:00.000Z",
        }),
      ],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      cleaners: {},
      assignment_offers: {},
      profiles: { "profile-1": { full_name: "Alex" } },
      authEmails: { "profile-1": "alex@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();
    const result = await processNotificationOutbox(client, {
      emailSender,
      now: new Date("2026-05-17T10:00:00.000Z"),
    });
    expect(result.scanned).toBe(0);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("pending");
  });

  it("respects batch size limit on deliverable poll", async () => {
    const ts = "2026-05-17T10:00:00.000Z";
    const db: MockDb = {
      outbox: Array.from({ length: 5 }, (_, i) =>
        outboxRow({
          id: `o-${i}`,
          recipient: "cust-1",
          created_at: ts,
          updated_at: ts,
          payload: { template: "payment_confirmed", bookingId: "booking-1" },
        }),
      ),
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      cleaners: {},
      assignment_offers: {},
      profiles: { "profile-1": { full_name: "Alex" } },
      authEmails: { "profile-1": "alex@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async () => ({
      ok: true as const,
      messageId: "msg",
    }));

    const result = await processNotificationOutbox(client, { emailSender, batchSize: 2 });
    expect(result.scanned).toBe(2);
    expect(result.sent).toBe(2);
    expect(db.outbox.filter((r) => r.status === "sent")).toHaveLength(2);
    expect(db.outbox.filter((r) => r.status === "pending")).toHaveLength(3);
  });

  it("leaves unrelated push templates pending", async () => {
    const db: MockDb = {
      outbox: [
        outboxRow({
          id: "o-other-push",
          recipient: "cleaner-1",
          channel: "push",
          payload: { template: "future_push_alert", bookingId: "booking-1" },
        }),
      ],
      bookings: {},
      customers: {},
      cleaners: {},
      assignment_offers: {},
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

  it("does not resend when payment_confirmed already sent for booking", async () => {
    hasSentPaymentConfirmedMock.mockResolvedValue(true);
    const db: MockDb = {
      outbox: [
        outboxRow({
          id: "o-dup",
          recipient: "cust-1",
          payload: { template: "payment_confirmed", bookingId: "booking-1" },
        }),
      ],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      cleaners: {},
      assignment_offers: {},
      profiles: { "profile-1": { full_name: "Alex" } },
      authEmails: { "profile-1": "alex@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn();

    const result = await processNotificationOutbox(client, { emailSender });
    expect(result.skipped).toBe(1);
    expect(emailSender).not.toHaveBeenCalled();
    expect(db.outbox[0]!.status).toBe("sent");
    expect(hasSentPaymentConfirmedMock).toHaveBeenCalledWith(
      client,
      "booking-1",
      "o-dup",
    );
  });

  it("sends first payment_confirmed and skips duplicate in same batch", async () => {
    hasSentPaymentConfirmedMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const db: MockDb = {
      outbox: [
        outboxRow({
          id: "o-first",
          recipient: "cust-1",
          payload: { template: "payment_confirmed", bookingId: "booking-1" },
        }),
        outboxRow({
          id: "o-second",
          recipient: "cust-1",
          payload: { template: "payment_confirmed", bookingId: "booking-1" },
        }),
      ],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      cleaners: {},
      assignment_offers: {},
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
    expect(result.skipped).toBe(1);
    expect(emailSender).toHaveBeenCalledOnce();
    expect(db.outbox[0]!.status).toBe("sent");
    expect(db.outbox[1]!.status).toBe("sent");
  });

  it("marks sent on successful payment_confirmed delivery", async () => {
    const db: MockDb = {
      outbox: [outboxRow({ id: "o1", recipient: "cust-1" })],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      cleaners: {},
      assignment_offers: {},
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
      cleaners: {},
      assignment_offers: {},
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
      cleaners: {},
      assignment_offers: {},
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
      cleaners: {},
      assignment_offers: {},
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
      cleaners: {},
      assignment_offers: {},
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
      cleaners: {},
      assignment_offers: {},
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
      cleaners: {},
      assignment_offers: {},
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
      cleaners: {},
      assignment_offers: {},
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

  it("dry_run processes payment_confirmed, payment_failed, and assignment_offer", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "dry_run";
    delete process.env.RESEND_API_KEY;

    const db: MockDb = {
      outbox: [
        outboxRow({ id: "o-pc", recipient: "cust-1" }),
        outboxRow({
          id: "o-pf",
          recipient: "cust-1",
          payload: { template: "payment_failed", bookingId: "booking-1" },
        }),
        offerOutboxRow({ id: "o-offer", recipient: "cleaner-1" }),
      ],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "payment_failed" },
        "booking-offer-1": defaultOfferBooking,
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      cleaners: { "cleaner-1": { id: "cleaner-1", profile_id: "profile-c1" } },
      assignment_offers: { "offer-1": defaultOpenOffer() },
      profiles: {
        "profile-1": { full_name: "Alex" },
        "profile-c1": { full_name: "Jordan" },
      },
      authEmails: {
        "profile-1": "alex@example.com",
        "profile-c1": "jordan@example.com",
      },
    };
    const client = createMockClient(db);
    const result = await processNotificationOutbox(client);

    expect(result.emailProvider).toBe("dry_run");
    expect(result.sent).toBe(3);
    expect(result.dryRunPreviews).toHaveLength(3);
    expect(result.dryRunPreviews.map((p) => p.template).sort()).toEqual([
      "assignment_offer",
      "payment_confirmed",
      "payment_failed",
    ]);
    expect(JSON.stringify(result.dryRunPreviews)).not.toContain("@");
  });

  it("dry_run assignment_offer links use APP_BASE_URL", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "dry_run";
    process.env.APP_BASE_URL = "https://cleaning-service-software.vercel.app";

    const db: MockDb = {
      outbox: [offerOutboxRow({ id: "o-offer", recipient: "cleaner-1" })],
      bookings: { "booking-offer-1": defaultOfferBooking },
      assignment_offers: { "offer-1": defaultOpenOffer() },
      cleaners: { "cleaner-1": { id: "cleaner-1", profile_id: "profile-c1" } },
      customers: {},
      profiles: { "profile-c1": { full_name: "Jordan" } },
      authEmails: { "profile-c1": "jordan@example.com" },
    };
    const client = createMockClient(db);
    const emailSender: EmailSender = vi.fn(async (params) => {
      expect(params.text).toContain(
        "https://cleaning-service-software.vercel.app/cleaner/offers",
      );
      expect(params.text).not.toContain("localhost");
      return { ok: true as const, messageId: "dry_run_test" };
    });

    await processNotificationOutbox(client, { emailSender });
  });

  it("dry_run preview-only leaves row pending when NOTIFICATION_DRY_RUN_MARK_SENT=false", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "dry_run";
    process.env.NOTIFICATION_DRY_RUN_MARK_SENT = "false";

    const db: MockDb = {
      outbox: [outboxRow({ id: "o-pc", recipient: "cust-1" })],
      bookings: {
        "booking-1": { ...defaultFailedBooking, status: "confirmed" },
      },
      customers: { "cust-1": { id: "cust-1", profile_id: "profile-1" } },
      cleaners: {},
      assignment_offers: {},
      profiles: { "profile-1": { full_name: "Alex" } },
      authEmails: { "profile-1": "alex@example.com" },
    };
    const client = createMockClient(db);
    const result = await processNotificationOutbox(client);

    expect(result.dryRun).toBe(1);
    expect(result.sent).toBe(0);
    expect(db.outbox[0]!.status).toBe("pending");
    expect(db.outbox[0]!.last_error).toContain("dry_run_sent");
    expect(db.outbox[0]!.last_error).not.toContain("@");
  });
});
