import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import type { Database, PaymentRow } from "@/lib/database/types";
import type { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { adminCreateBookingDraftFacade } from "./adminCreateBookingDraftFacade";
import { adminCreatePendingPaymentBookingFacade } from "./adminCreatePendingPaymentBookingFacade";
import { adminGeneratePaymentLinkFacade } from "./adminGeneratePaymentLinkFacade";
import { routePaystackWebhookEvent } from "@/features/payments/server/routePaystackWebhookEvent";
import type { AdminCreateBookingDraftBody } from "./parseAdminCreateBookingDraftBody";
import {
  applyPaystackUnitTestEnv,
  restorePaystackTestEnv,
  snapshotPaystackTestEnv,
} from "@/test/paystackTestEnv";

const paystackEnvSnapshot = snapshotPaystackTestEnv();

const completePaystackBookingCheckoutMock = vi.fn();
const dispatchMock = vi.hoisted(() => ({
  runPostPaymentAssignmentDispatch: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: () => true,
}));

vi.mock("@/lib/app/adminAssistedPaymentLinksFlag", () => ({
  isAdminAssistedPaymentLinksActive: () => true,
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
  resolveCustomerEmail: async () => ({
    ok: true,
    recipient: { email: "customer@example.com" },
  }),
}));

vi.mock("@/features/payments/server/paymentRepository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/payments/server/paymentRepository")
  >();
  return {
    ...actual,
    updatePaymentLinkMetadata: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/features/payments/server/postPaymentAssignmentDispatch", () => ({
  runPostPaymentAssignmentDispatch: dispatchMock.runPostPaymentAssignmentDispatch,
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => hoisted.assistClient,
}));

const hoisted = vi.hoisted(() => ({
  memoryBackend: null as InMemoryBookingCommandBackend | null,
  assistClient: null as SupabaseClient<Database>,
  assistState: {
    customers: new Set<string>(["11111111-1111-4111-8111-111111111111"]),
    idempotency: new Map<string, Record<string, unknown>>(),
    audits: [] as Record<string, unknown>[],
    paymentsByRef: new Map<string, PaymentRow>(),
    paymentsById: new Map<string, PaymentRow>(),
    paymentEventIds: new Set<string>(),
  },
}));

function createAssistMockClient(): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      if (table === "customers") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: hoisted.assistState.customers.has(value) ? { id: value } : null,
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
                data: hoisted.assistState.idempotency.has(key)
                  ? { result: hoisted.assistState.idempotency.get(key) }
                  : null,
                error: null,
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            const key = row.idempotency_key as string;
            if (hoisted.assistState.idempotency.has(key)) {
              return Promise.resolve({ error: { code: "23505", message: "duplicate" } });
            }
            hoisted.assistState.idempotency.set(key, row.result as Record<string, unknown>);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "admin_booking_assist_audit") {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                hoisted.assistState.audits.push(row);
                return { data: { id: `audit-${hoisted.assistState.audits.length}` }, error: null };
              },
            }),
          }),
        };
      }
      if (table === "payments") {
        return {
          select: () => ({
            eq: (column: string, value: string) => ({
              maybeSingle: async () => {
                if (column === "provider_ref") {
                  return {
                    data: hoisted.assistState.paymentsByRef.get(value) ?? null,
                    error: null,
                  };
                }
                if (column === "id") {
                  return {
                    data: hoisted.assistState.paymentsById.get(value) ?? null,
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
            }),
          }),
          update: (patch: Partial<PaymentRow>) => ({
            eq: (_column: string, id: string) => ({
              single: async () => {
                const row = hoisted.assistState.paymentsById.get(id);
                if (!row) return { data: null, error: { message: "not found" } };
                const next = { ...row, ...patch };
                hoisted.assistState.paymentsById.set(id, next);
                if (next.provider_ref) {
                  hoisted.assistState.paymentsByRef.set(next.provider_ref, next);
                }
                return { data: next, error: null };
              },
            }),
          }),
        };
      }
      if (table === "payment_events") {
        return {
          insert: async (row: { provider_event_id: string }) => {
            if (hoisted.assistState.paymentEventIds.has(row.provider_event_id)) {
              return { error: { code: "23505", message: "duplicate" } };
            }
            hoisted.assistState.paymentEventIds.add(row.provider_event_id);
            return { error: null };
          },
        };
      }
      if (table === "assignment_offers") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => {
    if (!hoisted.memoryBackend) throw new Error("memoryBackend missing");
    return hoisted.memoryBackend;
  },
}));

const adminUser: CurrentUser = {
  profileId: "admin-profile-1",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

function futureSchedule() {
  const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  start.setUTCHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  return { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() };
}

function sampleDraftBody(): AdminCreateBookingDraftBody {
  const schedule = futureSchedule();
  return {
    customerId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: `draft-${Math.random().toString(36).slice(2, 10)}`,
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

describe("admin-assisted Paystack payment flow (integration)", () => {
  beforeEach(async () => {
    applyPaystackUnitTestEnv();
    const { InMemoryBookingCommandBackend } = await import(
      "@/features/bookings/server/commands/inMemoryBookingCommandBackend"
    );
    hoisted.memoryBackend = new InMemoryBookingCommandBackend();
    hoisted.memoryBackend.bookings.clear();
    hoisted.memoryBackend.payments.clear();
    hoisted.assistState.idempotency.clear();
    hoisted.assistState.audits = [];
    hoisted.assistState.paymentsByRef.clear();
    hoisted.assistClient = createAssistMockClient();
    vi.stubEnv("BOOKING_COMMAND_BACKEND", "memory");
    dispatchMock.runPostPaymentAssignmentDispatch.mockClear();

    completePaystackBookingCheckoutMock.mockImplementation(
      async (input: { bookingId: string; payment: PaymentRow }) => {
        const reference = `bk_${input.bookingId.replace(/-/g, "").slice(0, 8)}_admin`;
        hoisted.assistState.paymentsByRef.set(reference, input.payment);
        return {
          ok: true,
          bookingId: input.bookingId,
          paymentId: input.payment.id,
          status: "pending_payment",
          authorizationUrl: "https://checkout.paystack.com/admin-assisted",
          accessCode: "access",
          reference,
        };
      },
    );
  });

  afterEach(() => {
    restorePaystackTestEnv(paystackEnvSnapshot);
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("draft → pending_payment → payment link → webhook confirms without pre-payment assignment", async () => {
    const draft = await adminCreateBookingDraftFacade({ admin: adminUser, body: sampleDraftBody() });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const bookingId = draft.bookingDraft.bookingId;

    const pending = await adminCreatePendingPaymentBookingFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "pending-flow-12345678",
      },
    });
    expect(pending.ok).toBe(true);

    expect(dispatchMock.runPostPaymentAssignmentDispatch).not.toHaveBeenCalled();

    const link = await adminGeneratePaymentLinkFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "plink-flow-12345678",
        deliveryChannel: "copy_only",
      },
    });
    expect(link.ok).toBe(true);
    if (!link.ok) return;

    const beforePay = hoisted.memoryBackend!.bookings.get(bookingId);
    expect(beforePay?.status).toBe("pending_payment");
    expect(dispatchMock.runPostPaymentAssignmentDispatch).not.toHaveBeenCalled();

    const pendingPayment = [...hoisted.memoryBackend!.payments.values()].find(
      (p) => p.booking_id === bookingId,
    );
    expect(pendingPayment).toBeTruthy();
    if (pendingPayment) {
      const synced = {
        ...pendingPayment,
        provider_ref: link.paymentLink.reference,
        amount_cents: beforePay!.price_cents,
      };
      hoisted.assistState.paymentsById.set(synced.id, synced);
      hoisted.assistState.paymentsByRef.set(link.paymentLink.reference, synced);
    }

    const upsertModule = await import("@/features/payments/server/upsertBookingFromPaystack");
    vi.spyOn(upsertModule, "processPaystackChargeSuccess").mockImplementation((charge, source) =>
      upsertModule.processPaystackChargeSuccessWithDeps(
        hoisted.assistClient,
        charge,
        source,
        hoisted.memoryBackend!,
      ),
    );

    const webhook = await routePaystackWebhookEvent({
      event: "charge.success",
      data: {
        id: 99001,
        status: "success",
        reference: link.paymentLink.reference,
        amount: beforePay!.price_cents,
        metadata: { source: "admin_assisted", booking_id: bookingId },
      },
    });

    expect(webhook.ok).toBe(true);
    if (webhook.ok && webhook.handled) {
      expect(webhook.status).toBe("confirmed");
    }

    const afterPay = hoisted.memoryBackend!.bookings.get(bookingId);
    expect(afterPay?.status).toBe("confirmed");
    expect(dispatchMock.runPostPaymentAssignmentDispatch).toHaveBeenCalled();
  });
});
