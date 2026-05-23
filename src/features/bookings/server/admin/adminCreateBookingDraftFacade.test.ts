import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import type { Database } from "@/lib/database/types";
import type { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";

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

import { adminCreateBookingDraftFacade } from "./adminCreateBookingDraftFacade";
import type { AdminCreateBookingDraftBody } from "./parseAdminCreateBookingDraftBody";

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

function sampleBody(overrides: Partial<AdminCreateBookingDraftBody> = {}): AdminCreateBookingDraftBody {
  const schedule = futureSchedule();
  return {
    customerId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: `admin-draft-test-${Math.random().toString(36).slice(2, 10)}`,
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
    ...overrides,
  };
}

describe("adminCreateBookingDraftFacade", () => {
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

  it("creates a draft booking for admin with server-side quote", async () => {
    const result = await adminCreateBookingDraftFacade({
      admin: adminUser,
      body: sampleBody(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookingDraft.status).toBe("draft");
    expect(result.bookingDraft.priceCents).toBeGreaterThan(0);

    const booking = hoisted.memoryBackend.bookings.get(result.bookingDraft.bookingId);
    expect(booking?.status).toBe("draft");
    expect(booking?.customer_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(hoisted.memoryBackend.payments.size).toBe(0);
    expect(
      hoisted.assistState.audits.some((row) => row.action === "admin_booking_draft_created"),
    ).toBe(true);
  });

  it("rejects non-admin actors", async () => {
    const result = await adminCreateBookingDraftFacade({
      admin: customerUser,
      body: sampleBody(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
  });

  it("rejects unknown customer", async () => {
    hoisted.assistState.customers.clear();
    const result = await adminCreateBookingDraftFacade({
      admin: adminUser,
      body: sampleBody(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("CUSTOMER_NOT_FOUND");
    expect(hoisted.memoryBackend.bookings.size).toBe(0);
  });

  it("returns idempotent result for duplicate idempotency key", async () => {
    const body = sampleBody({ idempotencyKey: "dup-key-stable-001" });
    const first = await adminCreateBookingDraftFacade({ admin: adminUser, body });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await adminCreateBookingDraftFacade({ admin: adminUser, body });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.bookingDraft.bookingId).toBe(first.bookingDraft.bookingId);
    expect(second.bookingDraft.idempotent).toBe(true);
    expect(hoisted.memoryBackend.bookings.size).toBe(1);
  });
});
