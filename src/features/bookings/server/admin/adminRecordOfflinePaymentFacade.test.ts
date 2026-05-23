import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import type { Database } from "@/lib/database/types";
import type { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { adminCreateBookingDraftFacade } from "./adminCreateBookingDraftFacade";
import { adminCreatePendingPaymentBookingFacade } from "./adminCreatePendingPaymentBookingFacade";
import { adminRecordOfflinePaymentFacade } from "./adminRecordOfflinePaymentFacade";
import type { AdminCreateBookingDraftBody } from "./parseAdminCreateBookingDraftBody";

const finalizePaidBookingWithDepsMock = vi.fn();
const assignmentDispatchMock = vi.fn();

const hoisted = vi.hoisted(() => ({
  memoryBackend: null as InMemoryBookingCommandBackend | null,
  offlinePaymentsActive: true,
  assistState: {
    customers: new Set<string>(["11111111-1111-4111-8111-111111111111"]),
    idempotency: new Map<string, Record<string, unknown>>(),
    audits: [] as Record<string, unknown>[],
    offlineEvents: [] as Record<string, unknown>[],
  },
}));

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: () => true,
}));

vi.mock("@/lib/app/adminAssistedOfflinePaymentsFlag", () => ({
  isAdminAssistedOfflinePaymentsActive: () => hoisted.offlinePaymentsActive,
}));

vi.mock("@/features/payments/server/finalizePaidBooking", () => ({
  finalizePaidBookingWithDeps: (...args: unknown[]) => finalizePaidBookingWithDepsMock(...args),
}));

vi.mock("@/features/assignments/server/runPostPaymentAssignmentDispatch", () => ({
  runPostPaymentAssignmentDispatch: (...args: unknown[]) => assignmentDispatchMock(...args),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => {
    if (!hoisted.memoryBackend) throw new Error("memoryBackend not initialized");
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
            eq: (_c: string, value: string) => ({
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
            eq: (_c: string, key: string) => ({
              maybeSingle: async () => ({
                data: state.idempotency.has(key) ? { result: state.idempotency.get(key) } : null,
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
      if (table === "admin_offline_payment_events") {
        const buildQuery = () => {
          const filters: Array<[string, string]> = [];
          const chain = {
            eq: (col: string, val: string) => {
              filters.push([col, val]);
              return chain;
            },
            maybeSingle: async () => {
              const row = state.offlineEvents.find((e) =>
                filters.every(([col, val]) => (e as Record<string, unknown>)[col] === val),
              );
              return { data: row ?? null, error: null };
            },
            select: () => chain,
            single: async () => {
              const row = state.offlineEvents.find((e) =>
                filters.every(([col, val]) => (e as Record<string, unknown>)[col] === val),
              );
              return { data: row ?? null, error: null };
            },
          };
          return chain;
        };
        return {
          select: () => buildQuery(),
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const id = `offline-${state.offlineEvents.length + 1}`;
                const stored = { ...row, id };
                state.offlineEvents.push(stored);
                return { data: stored, error: null };
              },
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: (_c: string, id: string) => ({
              then: (resolve: (v: unknown) => void) => {
                const row = state.offlineEvents.find((e) => e.id === id);
                if (row) Object.assign(row, patch);
                resolve({ error: null });
              },
            }),
          }),
        };
      }
      if (table === "payments") {
        const buildQuery = () => {
          const filters: Array<[string, string | string[]]> = [];
          const chain = {
            eq: (col: string, val: string) => {
              filters.push([col, val]);
              return chain;
            },
            in: (col: string, vals: string[]) => {
              filters.push([col, vals]);
              return chain;
            },
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => {
              let payments = [...hoisted.memoryBackend!.payments.values()];
              for (const [col, val] of filters) {
                if (col === "booking_id" && typeof val === "string") {
                  payments = payments.filter((p) => p.booking_id === val);
                } else if (col === "status" && typeof val === "string") {
                  payments = payments.filter((p) => p.status === val);
                } else if (col === "status" && Array.isArray(val)) {
                  payments = payments.filter((p) => val.includes(p.status));
                }
              }
              payments.sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
              );
              return { data: payments[0] ?? null, error: null };
            },
          };
          return chain;
        };
        return {
          select: () => buildQuery(),
          update: (patch: Record<string, unknown>) => ({
            eq: (_c: string, id: string) => ({
              then: (resolve: (v: unknown) => void) => {
                const payment = hoisted.memoryBackend!.payments.get(id);
                if (payment) Object.assign(payment, patch);
                resolve({ error: null });
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
    address: { addressLine1: "12 Main Rd", suburb: "Sea Point", city: "Cape Town" },
    cleanerPreferenceMode: "best_available",
  };
}

async function seedPendingBooking(): Promise<{ bookingId: string; priceCents: number }> {
  const draft = await adminCreateBookingDraftFacade({ admin: adminUser, body: sampleDraftBody() });
  if (!draft.ok) throw new Error("draft failed");
  const pending = await adminCreatePendingPaymentBookingFacade({
    admin: adminUser,
    bookingId: draft.bookingDraft.bookingId,
    body: {
      customerId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: `pending-${Math.random().toString(36).slice(2, 10)}`,
    },
  });
  if (!pending.ok) throw new Error("pending failed");
  return {
    bookingId: draft.bookingDraft.bookingId,
    priceCents: pending.booking.priceCents,
  };
}

function offlineBody(
  bookingId: string,
  priceCents: number,
  rail: "eft" | "cash" | "card_machine",
  idempotencyKey: string,
) {
  const base = {
    customerId: "11111111-1111-4111-8111-111111111111",
    amountCents: priceCents,
    rail,
    receivedAt: "2026-01-01T10:00:00.000Z",
    evidenceReference: "EV-001",
    reason: "Received in office",
    idempotencyKey,
  };
  if (rail === "eft") return { ...base, bankReference: "BNK-999" };
  if (rail === "cash") return { ...base, receiptNumber: "RCPT-1" };
  return { ...base, terminalReference: "TERM-88" };
}

describe("adminRecordOfflinePaymentFacade", () => {
  beforeEach(async () => {
    const { InMemoryBookingCommandBackend } = await import(
      "@/features/bookings/server/commands/inMemoryBookingCommandBackend"
    );
    hoisted.memoryBackend = new InMemoryBookingCommandBackend();
    hoisted.memoryBackend.bookings.clear();
    hoisted.memoryBackend.payments.clear();
    hoisted.assistState.idempotency.clear();
    hoisted.assistState.audits = [];
    hoisted.assistState.offlineEvents = [];
    hoisted.offlinePaymentsActive = true;
    vi.stubEnv("BOOKING_COMMAND_BACKEND", "memory");

    finalizePaidBookingWithDepsMock.mockImplementation(
      async (_client, _backend, input: { bookingId: string }) => {
        const booking = hoisted.memoryBackend!.bookings.get(input.bookingId);
        if (booking) booking.status = "confirmed";
        const payment = [...hoisted.memoryBackend!.payments.values()].find(
          (p) => p.booking_id === input.bookingId,
        );
        if (payment) payment.status = "paid";
        return {
          ok: true,
          bookingId: input.bookingId,
          status: "confirmed",
          idempotent: false,
          paymentEvent: "inserted",
        };
      },
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  for (const rail of ["eft", "cash", "card_machine"] as const) {
    it(`records ${rail} and calls finalizePaidBooking`, async () => {
      const { bookingId, priceCents } = await seedPendingBooking();
      const result = await adminRecordOfflinePaymentFacade({
        admin: adminUser,
        bookingId,
        body: offlineBody(bookingId, priceCents, rail, `offline-${rail}-12345678`),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payment.rail).toBe(rail);
      expect(finalizePaidBookingWithDepsMock).toHaveBeenCalledOnce();
      expect(assignmentDispatchMock).not.toHaveBeenCalled();
      expect(hoisted.memoryBackend!.bookings.get(bookingId)?.status).toBe("confirmed");
    });
  }

  it("rejects amount mismatch", async () => {
    const { bookingId, priceCents } = await seedPendingBooking();
    const result = await adminRecordOfflinePaymentFacade({
      admin: adminUser,
      bookingId,
      body: offlineBody(bookingId, priceCents + 100, "eft", "offline-mismatch-12345678"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AMOUNT_MISMATCH");
    expect(finalizePaidBookingWithDepsMock).not.toHaveBeenCalled();
  });

  it("rejects draft booking", async () => {
    const draft = await adminCreateBookingDraftFacade({ admin: adminUser, body: sampleDraftBody() });
    if (!draft.ok) throw new Error("draft failed");
    const result = await adminRecordOfflinePaymentFacade({
      admin: adminUser,
      bookingId: draft.bookingDraft.bookingId,
      body: offlineBody(draft.bookingDraft.bookingId, 1000, "eft", "offline-draft-12345678"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_STATUS");
  });

  it("replays idempotency", async () => {
    const { bookingId, priceCents } = await seedPendingBooking();
    const body = offlineBody(bookingId, priceCents, "eft", "offline-idem-12345678");
    const first = await adminRecordOfflinePaymentFacade({ admin: adminUser, bookingId, body });
    const second = await adminRecordOfflinePaymentFacade({ admin: adminUser, bookingId, body });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.payment.idempotent).toBe(true);
    expect(finalizePaidBookingWithDepsMock).toHaveBeenCalledTimes(1);
  });
});

describe("adminRecordOfflinePaymentFacade safety (static)", () => {
  it("uses finalizePaidBooking and not assignment dispatch", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src/features/bookings/server/admin/adminRecordOfflinePaymentFacade.ts"),
      "utf8",
    );
    expect(source).toContain("finalizePaidBookingWithDeps");
    expect(source).not.toMatch(/\brunPostPaymentAssignmentDispatch\b/);
    expect(source).not.toMatch(/\brunAssignmentAfterPayment\b/);
    expect(source).not.toMatch(/\bADMIN_OVERRIDE_STATUS\b/);
    expect(source).not.toMatch(/\bexecuteBookingCommand\s*\(/);
  });
});
