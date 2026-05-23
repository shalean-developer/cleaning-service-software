import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import type { Database } from "@/lib/database/types";
import type { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { adminCreateBookingDraftFacade } from "./adminCreateBookingDraftFacade";
import { adminCreatePendingPaymentBookingFacade } from "./adminCreatePendingPaymentBookingFacade";
import { adminGeneratePaymentLinkFacade } from "./adminGeneratePaymentLinkFacade";
import { adminSendPaymentRequestNotificationFacade } from "./adminSendPaymentRequestNotificationFacade";
import type { AdminCreateBookingDraftBody } from "./parseAdminCreateBookingDraftBody";

const completePaystackBookingCheckoutMock = vi.fn();
const resolveCustomerEmailMock = vi.fn();
const updatePaymentLinkMetadataMock = vi.fn();
const finalizePaidBookingMock = vi.fn();
const assignmentDispatchMock = vi.fn();

const hoisted = vi.hoisted(() => ({
  memoryBackend: null as InMemoryBookingCommandBackend | null,
  paymentLinksActive: true,
  assistState: {
    customers: new Set<string>(["11111111-1111-4111-8111-111111111111"]),
    idempotency: new Map<string, Record<string, unknown>>(),
    audits: [] as Record<string, unknown>[],
    outbox: [] as Record<string, unknown>[],
  },
}));

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: () => true,
}));

vi.mock("@/lib/app/adminAssistedPaymentLinksFlag", () => ({
  isAdminAssistedPaymentLinksActive: () => hoisted.paymentLinksActive,
}));

vi.mock("@/features/payments/server/paystackEnv", () => ({
  isPaystackEnabled: () => true,
}));

vi.mock("@/features/payments/server/completePaystackBookingCheckout", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/payments/server/completePaystackBookingCheckout")
  >();
  return {
    ...actual,
    completePaystackBookingCheckout: (...args: unknown[]) =>
      completePaystackBookingCheckoutMock(...args),
  };
});

vi.mock("@/features/notifications/server/resolveCustomerEmail", () => ({
  resolveCustomerEmail: (...args: unknown[]) => resolveCustomerEmailMock(...args),
}));

vi.mock("@/features/payments/server/paymentRepository", () => ({
  updatePaymentLinkMetadata: (...args: unknown[]) => updatePaymentLinkMetadataMock(...args),
}));

vi.mock("@/features/payments/server/finalizePaidBooking", () => ({
  finalizePaidBooking: (...args: unknown[]) => finalizePaidBookingMock(...args),
}));

vi.mock("@/features/assignments/server/runPostPaymentAssignmentDispatch", () => ({
  runPostPaymentAssignmentDispatch: (...args: unknown[]) => assignmentDispatchMock(...args),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => {
    if (!hoisted.memoryBackend) {
      throw new Error("memoryBackend not initialized");
    }
    return hoisted.memoryBackend;
  },
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => createAssistMockClient(hoisted.assistState),
}));

function createAssistMockClient(state: typeof hoisted.assistState): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      if (table === "customers") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: state.customers.has(value) ? { id: value } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "admin_booking_assist_idempotency") {
        return {
          select: () => ({
            eq: (_column: string, key: string) => ({
              maybeSingle: async () => ({
                data: state.idempotency.has(key)
                  ? { result: state.idempotency.get(key) }
                  : null,
                error: null,
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            const key = row.idempotency_key as string;
            if (state.idempotency.has(key)) {
              return Promise.resolve({ error: { code: "23505", message: "duplicate" } });
            }
            state.idempotency.set(key, row.result as Record<string, unknown>);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "admin_booking_assist_audit") {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                state.audits.push(row);
                return { data: { id: `audit-${state.audits.length}` }, error: null };
              },
            }),
          }),
        };
      }
      if (table === "notification_outbox") {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const id = `outbox-${state.outbox.length + 1}`;
                state.outbox.push({ ...row, id });
                return { data: { id }, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

const adminUser: CurrentUser = {
  profileId: "admin-profile-1",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

function futureSchedule(): { scheduledStart: string; scheduledEnd: string } {
  const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  start.setUTCHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  return { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() };
}

function sampleDraftBody(): AdminCreateBookingDraftBody {
  const schedule = futureSchedule();
  return {
    customerId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: `admin-draft-${Math.random().toString(36).slice(2, 10)}`,
    scheduledStart: schedule.scheduledStart,
    scheduledEnd: schedule.scheduledEnd,
    pricingInput: {
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: "once",
    },
    address: {
      addressLine1: "12 Main Rd",
      suburb: "Sea Point",
      city: "Cape Town",
    },
    cleanerPreferenceMode: "best_available",
  };
}

async function seedPendingWithActiveLink(): Promise<{
  bookingId: string;
  paymentUrl: string;
  reference: string;
}> {
  const draft = await adminCreateBookingDraftFacade({ admin: adminUser, body: sampleDraftBody() });
  expect(draft.ok).toBe(true);
  if (!draft.ok) throw new Error("draft failed");

  const pending = await adminCreatePendingPaymentBookingFacade({
    admin: adminUser,
    bookingId: draft.bookingDraft.bookingId,
    body: {
      customerId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: `pending-${Math.random().toString(36).slice(2, 10)}`,
    },
  });
  expect(pending.ok).toBe(true);
  if (!pending.ok) throw new Error("pending failed");

  const link = await adminGeneratePaymentLinkFacade({
    admin: adminUser,
    bookingId: draft.bookingDraft.bookingId,
    body: {
      customerId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: `plink-${Math.random().toString(36).slice(2, 10)}`,
      deliveryChannel: "copy_only",
    },
  });
  expect(link.ok).toBe(true);
  if (!link.ok) throw new Error("link failed");

  return {
    bookingId: draft.bookingDraft.bookingId,
    paymentUrl: link.paymentLink.paymentUrl,
    reference: link.paymentLink.reference,
  };
}

describe("adminSendPaymentRequestNotificationFacade", () => {
  beforeEach(async () => {
    const { InMemoryBookingCommandBackend } = await import(
      "@/features/bookings/server/commands/inMemoryBookingCommandBackend"
    );
    hoisted.memoryBackend = new InMemoryBookingCommandBackend();
    hoisted.memoryBackend.bookings.clear();
    hoisted.memoryBackend.payments.clear();
    hoisted.assistState.idempotency.clear();
    hoisted.assistState.audits = [];
    hoisted.assistState.outbox = [];
    hoisted.paymentLinksActive = true;
    vi.stubEnv("BOOKING_COMMAND_BACKEND", "memory");

    resolveCustomerEmailMock.mockResolvedValue({
      ok: true,
      recipient: { email: "customer@example.com", displayName: "Test Customer" },
    });
    updatePaymentLinkMetadataMock.mockResolvedValue(undefined);
    completePaystackBookingCheckoutMock.mockImplementation(
      async (input: { bookingId: string; payment: { id: string } }) => ({
        ok: true,
        bookingId: input.bookingId,
        paymentId: input.payment.id,
        status: "pending_payment",
        authorizationUrl: "https://checkout.paystack.com/admin-assisted",
        accessCode: "access-code",
        reference: `bk_${input.bookingId.replace(/-/g, "").slice(0, 8)}_payref`,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("queues email for valid pending_payment booking with active link", async () => {
    const { bookingId, paymentUrl } = await seedPendingWithActiveLink();

    const result = await adminSendPaymentRequestNotificationFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        deliveryChannel: "email",
        idempotencyKey: "notify-email-12345678",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notification.status).toBe("queued");
    expect(result.notification.paymentUrl).toBe(paymentUrl);
    expect(hoisted.assistState.outbox).toHaveLength(1);
    expect(hoisted.assistState.audits.some((a) => a.action === "admin_booking_payment_request_sent")).toBe(
      true,
    );
    expect(hoisted.memoryBackend!.bookings.get(bookingId)?.status).toBe("pending_payment");
    expect(finalizePaidBookingMock).not.toHaveBeenCalled();
    expect(assignmentDispatchMock).not.toHaveBeenCalled();
    expect(completePaystackBookingCheckoutMock).toHaveBeenCalledTimes(1);
  });

  it("returns WhatsApp copy text for whatsapp_copy", async () => {
    const { bookingId } = await seedPendingWithActiveLink();

    const result = await adminSendPaymentRequestNotificationFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        deliveryChannel: "whatsapp_copy",
        idempotencyKey: "notify-wa-12345678",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notification.status).toBe("copied");
    expect(result.notification.copiedText).toContain("Pay securely here:");
    expect(hoisted.assistState.outbox).toHaveLength(0);
  });

  it("rejects draft booking", async () => {
    const draft = await adminCreateBookingDraftFacade({ admin: adminUser, body: sampleDraftBody() });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const result = await adminSendPaymentRequestNotificationFacade({
      admin: adminUser,
      bookingId: draft.bookingDraft.bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        deliveryChannel: "email",
        idempotencyKey: "notify-draft-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_STATUS");
  });

  it("rejects confirmed booking", async () => {
    const { bookingId } = await seedPendingWithActiveLink();
    const booking = hoisted.memoryBackend!.bookings.get(bookingId);
    if (booking) booking.status = "confirmed";

    const result = await adminSendPaymentRequestNotificationFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        deliveryChannel: "email",
        idempotencyKey: "notify-conf-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_STATUS");
  });

  it("rejects expired link", async () => {
    const { bookingId } = await seedPendingWithActiveLink();
    const booking = hoisted.memoryBackend!.bookings.get(bookingId);
    if (booking?.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)) {
      const meta = booking.metadata as Record<string, unknown>;
      const assist = meta.adminAssist as Record<string, unknown>;
      const link = assist.paymentLink as Record<string, unknown>;
      link.expiresAt = "2000-01-01T00:00:00.000Z";
    }

    const result = await adminSendPaymentRequestNotificationFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        deliveryChannel: "email",
        idempotencyKey: "notify-exp-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("LINK_EXPIRED");
  });

  it("rejects missing customer email for email channel", async () => {
    const { bookingId } = await seedPendingWithActiveLink();
    resolveCustomerEmailMock.mockResolvedValueOnce({ ok: false, code: "NO_EMAIL" });

    const result = await adminSendPaymentRequestNotificationFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        deliveryChannel: "email",
        idempotencyKey: "notify-noemail-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("CUSTOMER_EMAIL_MISSING");
  });

  it("replays idempotency with same result", async () => {
    const { bookingId } = await seedPendingWithActiveLink();
    const body = {
      customerId: "11111111-1111-4111-8111-111111111111",
      deliveryChannel: "email" as const,
      idempotencyKey: "notify-idem-12345678",
    };

    const first = await adminSendPaymentRequestNotificationFacade({
      admin: adminUser,
      bookingId,
      body,
    });
    const second = await adminSendPaymentRequestNotificationFacade({
      admin: adminUser,
      bookingId,
      body,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.notification.idempotent).toBe(true);
    expect(second.notification.paymentUrl).toBe(first.notification.paymentUrl);
    expect(hoisted.assistState.outbox).toHaveLength(1);
  });
});

describe("adminSendPaymentRequestNotificationFacade safety (static)", () => {
  it("must not import payment finalize or assignment modules", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(
        process.cwd(),
        "src/features/bookings/server/admin/adminSendPaymentRequestNotificationFacade.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/\bfinalizePaidBooking\b/);
    expect(source).not.toMatch(/\brunPostPaymentAssignmentDispatch\b/);
    expect(source).not.toMatch(/\bADMIN_OVERRIDE_STATUS\b/);
    expect(source).not.toMatch(/\bcompletePaystackBookingCheckout\b/);
  });
});
