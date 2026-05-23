import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import type { Database } from "@/lib/database/types";
import type { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { adminCreateBookingDraftFacade } from "./adminCreateBookingDraftFacade";
import { adminCreatePendingPaymentBookingFacade } from "./adminCreatePendingPaymentBookingFacade";
import { adminRecordOfflinePaymentFacade } from "./adminRecordOfflinePaymentFacade";
import { isAdminAssistedBookingMetadata } from "./adminAssistMetadata";
import type { AdminCreateBookingDraftBody } from "./parseAdminCreateBookingDraftBody";
import {
  buildRecurringAdminAssistDraftBody,
  readRecurringScheduleFromBookingMetadata,
  simulateRecurringMaterialization,
} from "./adminAssistedRecurringIntegrationHarness";

const dispatchMock = vi.hoisted(() => ({
  runPostPaymentAssignmentDispatch: vi.fn().mockResolvedValue({ ok: true }),
}));

const recurringMaterializationMock = vi.hoisted(() => ({
  runPostPaymentRecurringMaterialization: vi.fn(),
  materialized: [] as Array<{
    bookingId: string;
    selectedDays: number[];
    groupId: string | null;
    seriesIds: string[];
  }>,
}));

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: () => true,
}));

vi.mock("@/lib/app/adminAssistedOfflinePaymentsFlag", () => ({
  isAdminAssistedOfflinePaymentsActive: () => true,
}));

vi.mock("@/features/payments/server/postPaymentAssignmentDispatch", () => ({
  runPostPaymentAssignmentDispatch: dispatchMock.runPostPaymentAssignmentDispatch,
}));

vi.mock("@/features/recurring/postPaymentRecurringMaterialization", () => ({
  runPostPaymentRecurringMaterialization: (...args: unknown[]) =>
    recurringMaterializationMock.runPostPaymentRecurringMaterialization(...args),
}));

const hoisted = vi.hoisted(() => ({
  memoryBackend: null as InMemoryBookingCommandBackend | null,
  assistState: {
    customers: new Set<string>(["11111111-1111-4111-8111-111111111111"]),
    idempotency: new Map<string, Record<string, unknown>>(),
    audits: [] as Record<string, unknown>[],
    offlineEvents: [] as Record<string, unknown>[],
  },
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
                const stored = { ...row, id, status: "recorded" };
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
      if (table === "payment_events") {
        return {
          insert: async () => ({ error: null }),
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

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => {
    if (!hoisted.memoryBackend) throw new Error("memoryBackend missing");
    return hoisted.memoryBackend;
  },
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => createAssistMockClient(hoisted.assistState),
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
    address: { addressLine1: "12 Main Rd", suburb: "Sea Point", city: "Cape Town" },
    cleanerPreferenceMode: "best_available",
  };
}

describe("admin-assisted offline payment flow (integration)", () => {
  beforeEach(async () => {
    const { InMemoryBookingCommandBackend } = await import(
      "@/features/bookings/server/commands/inMemoryBookingCommandBackend"
    );
    hoisted.memoryBackend = new InMemoryBookingCommandBackend();
    hoisted.memoryBackend.bookings.clear();
    hoisted.memoryBackend.payments.clear();
    hoisted.memoryBackend.earnings = [];
    hoisted.assistState.idempotency.clear();
    hoisted.assistState.audits = [];
    hoisted.assistState.offlineEvents = [];
    vi.stubEnv("BOOKING_COMMAND_BACKEND", "memory");
    dispatchMock.runPostPaymentAssignmentDispatch.mockClear();
    recurringMaterializationMock.materialized = [];
    recurringMaterializationMock.runPostPaymentRecurringMaterialization.mockImplementation(
      async (_client, backend, booking) => {
        const result = simulateRecurringMaterialization(
          backend as { bookings: Map<string, { id: string; series_id: string | null; metadata: unknown }> },
          booking as { id: string; metadata: unknown },
        );
        if (result) recurringMaterializationMock.materialized.push(result);
      },
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("draft → pending_payment → offline EFT → confirmed via finalizePaidBooking", async () => {
    const draft = await adminCreateBookingDraftFacade({ admin: adminUser, body: sampleDraftBody() });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const bookingId = draft.bookingDraft.bookingId;

    const pending = await adminCreatePendingPaymentBookingFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "pending-offline-flow-12345678",
      },
    });
    expect(pending.ok).toBe(true);
    expect(dispatchMock.runPostPaymentAssignmentDispatch).not.toHaveBeenCalled();

    const priceCents = hoisted.memoryBackend!.bookings.get(bookingId)!.price_cents;
    const beforeStatus = hoisted.memoryBackend!.bookings.get(bookingId)!.status;
    expect(beforeStatus).toBe("pending_payment");

    const offline = await adminRecordOfflinePaymentFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        amountCents: priceCents,
        rail: "eft",
        bankReference: "BNK-OFFLINE-1",
        receivedAt: "2026-01-01T10:00:00.000Z",
        evidenceReference: "EV-100",
        reason: "EFT received",
        idempotencyKey: "offline-eft-flow-12345678",
      },
    });

    expect(offline.ok).toBe(true);
    if (!offline.ok) return;

    const booking = hoisted.memoryBackend!.bookings.get(bookingId);
    expect(booking?.status).toBe("confirmed");
    expect(isAdminAssistedBookingMetadata(booking?.metadata ?? null)).toBe(true);
    expect(dispatchMock.runPostPaymentAssignmentDispatch).toHaveBeenCalled();

    const finalizedEvent = hoisted.assistState.offlineEvents.find(
      (e) => e.booking_id === bookingId && e.status === "finalized",
    );
    expect(finalizedEvent).toBeTruthy();

    expect(
      hoisted.assistState.audits.some((a) => a.action === "admin_booking_offline_payment_recorded"),
    ).toBe(true);

    expect(hoisted.memoryBackend!.earnings.filter((e) => e.booking_id === bookingId)).toHaveLength(
      0,
    );
  });

  it("recurring draft → pending_payment → offline EFT → materializes after finalize", async () => {
    const body = buildRecurringAdminAssistDraftBody(
      {
        label: "custom Mon + Thu weekly offline",
        pricingFrequency: "weekly",
        recurringSchedule: {
          selectedDays: [1, 4],
          intervalWeeks: 1,
          configuredVia: "admin_wizard_custom",
        },
      },
      "recurring-offline-mon-thu-12345678",
    );

    const draft = await adminCreateBookingDraftFacade({ admin: adminUser, body });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const bookingId = draft.bookingDraft.bookingId;

    const pending = await adminCreatePendingPaymentBookingFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: body.customerId,
        idempotencyKey: "pending-recurring-offline-12345678",
      },
    });
    expect(pending.ok).toBe(true);
    expect(dispatchMock.runPostPaymentAssignmentDispatch).not.toHaveBeenCalled();
    expect(recurringMaterializationMock.runPostPaymentRecurringMaterialization).not.toHaveBeenCalled();

    const priceCents = hoisted.memoryBackend!.bookings.get(bookingId)!.price_cents;
    const offline = await adminRecordOfflinePaymentFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: body.customerId,
        amountCents: priceCents,
        rail: "eft",
        bankReference: "BNK-RECURRING-OFFLINE",
        receivedAt: "2026-01-01T10:00:00.000Z",
        evidenceReference: "EV-RECURRING",
        reason: "EFT received",
        idempotencyKey: "offline-recurring-flow-12345678",
      },
    });

    expect(offline.ok).toBe(true);
    if (!offline.ok) return;

    const booking = hoisted.memoryBackend!.bookings.get(bookingId);
    expect(booking?.status).toBe("confirmed");
    expect(isAdminAssistedBookingMetadata(booking?.metadata ?? null)).toBe(true);

    const persisted = readRecurringScheduleFromBookingMetadata(booking?.metadata);
    expect(persisted?.selectedDays).toEqual([1, 4]);
    expect(persisted?.intervalWeeks).toBe(1);

    expect(dispatchMock.runPostPaymentAssignmentDispatch).toHaveBeenCalled();
    expect(recurringMaterializationMock.runPostPaymentRecurringMaterialization).toHaveBeenCalled();

    const materialized = recurringMaterializationMock.materialized.at(-1);
    expect(materialized?.groupId).toBeTruthy();
    expect(materialized?.seriesIds).toHaveLength(2);
    expect(booking?.series_id).toBeTruthy();
  });
});
