import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import type { Database } from "@/lib/database/types";
import type { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { buildAdminBookingDraftMetadata } from "./buildAdminBookingDraftMetadata";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { adminCreateBookingDraftFacade } from "./adminCreateBookingDraftFacade";
import type { AdminCreateBookingDraftBody } from "./parseAdminCreateBookingDraftBody";
import { adminCreatePendingPaymentBookingFacade } from "./adminCreatePendingPaymentBookingFacade";

const hoisted = vi.hoisted(() => ({
  memoryBackend: null as InMemoryBookingCommandBackend | null,
  assistState: {
    customers: new Set<string>(["11111111-1111-4111-8111-111111111111"]),
    idempotency: new Map<string, Record<string, unknown>>(),
    audits: [] as Record<string, unknown>[],
  },
}));

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: () => true,
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
      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

const adminUser: CurrentUser = {
  profileId: "admin-profile-1",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

const customerUser: CurrentUser = {
  profileId: "customer-profile",
  role: "customer",
  authUser: { id: "auth-customer" } as CurrentUser["authUser"],
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

async function createAdminAssistDraft(): Promise<string> {
  const body = sampleDraftBody();
  const result = await adminCreateBookingDraftFacade({ admin: adminUser, body });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("draft failed");
  return result.bookingDraft.bookingId;
}

describe("adminCreatePendingPaymentBookingFacade", () => {
  beforeEach(async () => {
    const { InMemoryBookingCommandBackend } = await import(
      "@/features/bookings/server/commands/inMemoryBookingCommandBackend"
    );
    hoisted.memoryBackend = new InMemoryBookingCommandBackend();
    hoisted.memoryBackend.bookings.clear();
    hoisted.memoryBackend.payments.clear();
    hoisted.memoryBackend.audits = [];
    hoisted.assistState.idempotency.clear();
    hoisted.assistState.audits = [];
    hoisted.assistState.customers = new Set(["11111111-1111-4111-8111-111111111111"]);
    vi.stubEnv("BOOKING_COMMAND_BACKEND", "memory");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("moves admin-assisted draft to pending_payment", async () => {
    const bookingId = await createAdminAssistDraft();
    const idempotencyKey = `pending-${Math.random().toString(36).slice(2, 10)}`;

    const result = await adminCreatePendingPaymentBookingFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.booking.status).toBe("pending_payment");
    expect(result.booking.paymentStatus).toBe("pending");
    expect(result.booking.bookingId).toBe(bookingId);

    const booking = hoisted.memoryBackend!.bookings.get(bookingId);
    expect(booking?.status).toBe("pending_payment");
    expect(hoisted.memoryBackend!.payments.size).toBe(1);
    expect(
      hoisted.assistState.audits.some((row) => row.action === "admin_booking_pending_payment_created"),
    ).toBe(true);
  });

  it("rejects non-admin", async () => {
    const bookingId = await createAdminAssistDraft();
    const result = await adminCreatePendingPaymentBookingFacade({
      admin: customerUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "pending-key-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
  });

  it("rejects unknown booking", async () => {
    const result = await adminCreatePendingPaymentBookingFacade({
      admin: adminUser,
      bookingId: "99999999-9999-4999-8999-999999999999",
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "pending-key-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("BOOKING_NOT_FOUND");
  });

  it("rejects wrong customer", async () => {
    const bookingId = await createAdminAssistDraft();
    const result = await adminCreatePendingPaymentBookingFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "22222222-2222-4222-8222-222222222222",
        idempotencyKey: "pending-key-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("WRONG_CUSTOMER");
  });

  it("rejects non-draft booking", async () => {
    const bookingId = await createAdminAssistDraft();
    const first = await adminCreatePendingPaymentBookingFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "pending-first-12345678",
      },
    });
    expect(first.ok).toBe(true);

    const second = await adminCreatePendingPaymentBookingFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "pending-second-12345678",
      },
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("INVALID_STATUS");
  });

  it("replays idempotency without duplicate transition", async () => {
    const bookingId = await createAdminAssistDraft();
    const idempotencyKey = "pending-idem-12345678";

    const first = await adminCreatePendingPaymentBookingFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey,
      },
    });
    const second = await adminCreatePendingPaymentBookingFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey,
      },
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.booking.idempotent).toBe(true);
    expect(hoisted.memoryBackend!.payments.size).toBe(1);
  });

  it("does not confirm booking after pending_payment", async () => {
    const bookingId = await createAdminAssistDraft();
    await adminCreatePendingPaymentBookingFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "pending-confirm-guard-123",
      },
    });
    const booking = hoisted.memoryBackend!.bookings.get(bookingId);
    expect(booking?.status).toBe("pending_payment");
    expect(booking?.status).not.toBe("confirmed");
  });
});

describe("adminCreatePendingPaymentBookingFacade safety (static)", () => {
  it("must not import payment finalize or assignment modules", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src/features/bookings/server/admin/adminCreatePendingPaymentBookingFacade.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/\bfinalizePaidBooking\b/);
    expect(source).not.toMatch(/\binitializePayment\b/);
    expect(source).not.toMatch(/\bcompletePaystackInitialize\b/);
    expect(source).not.toMatch(/\brunPostPaymentAssignmentDispatch\b/);
    expect(source).not.toMatch(/\brunAssignmentAfterPayment\b/);
    expect(source).not.toMatch(/\bADMIN_OVERRIDE_STATUS\b/);
    expect(source).not.toMatch(/\bFINALIZE_PAYMENT_SUCCESS\b/);
    expect(source).toContain("MARK_PAYMENT_PENDING");
  });
});

describe("validateAdminAssistedBookingReady", () => {
  it("requires admin assist metadata", async () => {
    const { validateAdminAssistedDraftForPendingPayment } = await import(
      "./validateAdminAssistedBookingReady"
    );
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: "once",
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const schedule = futureSchedule();
    const metadata = buildAdminBookingDraftMetadata({
      adminProfileId: "admin-1",
      idempotencyKey: "k",
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        frequency: "once",
      },
      breakdown: quote.breakdown,
      address: {
        addressLine1: "12 Main",
        suburb: "Sea Point",
        city: "Cape Town",
      },
    });

    const withoutAssist = validateAdminAssistedDraftForPendingPayment({
      id: "b1",
      customer_id: "c1",
      status: "draft",
      scheduled_start: schedule.scheduledStart,
      scheduled_end: schedule.scheduledEnd,
      price_cents: 1000,
      metadata: { quote: metadata.quote },
    });
    expect(withoutAssist.ok).toBe(false);
  });
});
