import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssignmentOfferRow,
  CleanerOperationalAuditRow,
  CleanerRow,
  Database,
} from "@/lib/database/types";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { archiveCleaner } from "./archiveCleaner";
import { cancelCleanerOpenOffers } from "./cancelCleanerOpenOffers";
import { deactivateCleaner } from "./deactivateCleaner";
import { enableCleanerLifecycleColumnWrite } from "./enableLifecycleColumnWrite";
import { reactivateCleaner } from "./reactivateCleaner";
import { suspendCleaner } from "./suspendCleaner";
import { unsuspendCleaner } from "./unsuspendCleaner";

vi.mock("./enableLifecycleColumnWrite", () => ({
  enableCleanerLifecycleColumnWrite: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lifecycleQueries", () => ({
  countActiveBookingsForCleaner: vi.fn().mockResolvedValue(0),
  countPendingEarningsForCleaner: vi.fn().mockResolvedValue(0),
}));

let commandTestBackend: InMemoryBookingCommandBackend;
vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: vi.fn(() => commandTestBackend),
}));

const { countActiveBookingsForCleaner } = await import("./lifecycleQueries");

type TestState = {
  cleaners: Map<string, CleanerRow>;
  audits: CleanerOperationalAuditRow[];
  rpcCalled: boolean;
};

function baseCleaner(overrides: Partial<CleanerRow> = {}): CleanerRow {
  const now = "2026-05-19T12:00:00.000Z";
  return {
    id: "cleaner-1",
    profile_id: "profile-1",
    phone: null,
    active: true,
    suspended_at: null,
    deleted_at: null,
    onboarding_completed_at: "2024-01-01T00:00:00.000Z",
    suspension_ends_at: null,
    lifecycle_reason: null,
    average_rating: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function createMockLifecycleClient(state: TestState): SupabaseClient<Database> {
  const from = (table: string) => {
    const api = {
      select: () => api,
      eq: () => api,
      in: () => api,
      maybeSingle: async () => {
        if (table === "cleaners") {
          const id = state.cleaners.keys().next().value;
          return { data: state.cleaners.get(id!) ?? null, error: null };
        }
        if (table === "cleaner_operational_audit") {
          return { data: state.audits[0] ?? null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (table === "cleaners") {
          const row = [...state.cleaners.values()][0]!;
          return { data: row, error: null };
        }
        if (table === "cleaner_operational_audit") {
          const row = state.audits[state.audits.length - 1]!;
          return { data: row, error: null };
        }
        return { data: null, error: null };
      },
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            if (table === "cleaner_operational_audit") {
              const audit: CleanerOperationalAuditRow = {
                id: `audit-${state.audits.length + 1}`,
                cleaner_id: row.cleaner_id as string,
                admin_profile_id: row.admin_profile_id as string | null,
                action: row.action as string,
                outcome: row.outcome as string,
                reason: (row.reason as string | null) ?? null,
                before_state: row.before_state as CleanerOperationalAuditRow["before_state"],
                after_state: row.after_state as CleanerOperationalAuditRow["after_state"],
                affected_counts:
                  row.affected_counts as CleanerOperationalAuditRow["affected_counts"],
                metadata: row.metadata as CleanerOperationalAuditRow["metadata"],
                idempotency_key: (row.idempotency_key as string | null) ?? null,
                created_at: new Date().toISOString(),
              };
              state.audits.push(audit);
              return { data: audit, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
      update: (patch: Partial<CleanerRow>) => ({
        eq: (_col: string, cleanerId: string) => ({
          select: () => ({
            single: async () => {
              const existing = state.cleaners.get(cleanerId);
              if (!existing) return { data: null, error: { message: "not found" } };
              const updated = {
                ...existing,
                ...patch,
                updated_at: new Date().toISOString(),
              };
              state.cleaners.set(cleanerId, updated);
              return { data: updated, error: null };
            },
          }),
        }),
      }),
    };
    return api;
  };

  return {
    from: (table: string) => {
      if (table === "cleaners") {
        return {
          select: (_cols?: string) => ({
            eq: (_c: string, cleanerId: string) => ({
              maybeSingle: async () => ({
                data: state.cleaners.get(cleanerId) ?? null,
                error: null,
              }),
              single: async () => {
                const data = state.cleaners.get(cleanerId);
                if (!data) return { data: null, error: { message: "not found" } };
                return { data, error: null };
              },
            }),
          }),
          update: (patch: Partial<CleanerRow>) => ({
            eq: (_c: string, cleanerId: string) => ({
              select: () => ({
                single: async () => {
                  const existing = state.cleaners.get(cleanerId);
                  if (!existing) return { data: null, error: { message: "not found" } };
                  const updated = {
                    ...existing,
                    ...patch,
                    updated_at: new Date().toISOString(),
                  };
                  state.cleaners.set(cleanerId, updated);
                  return { data: updated, error: null };
                },
              }),
            }),
          }),
        };
      }
      if (table === "cleaner_operational_audit") {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const audit: CleanerOperationalAuditRow = {
                  id: `audit-${state.audits.length + 1}`,
                  cleaner_id: row.cleaner_id as string,
                  admin_profile_id: row.admin_profile_id as string | null,
                  action: row.action as string,
                  outcome: row.outcome as string,
                  reason: (row.reason as string | null) ?? null,
                  before_state: row.before_state as CleanerOperationalAuditRow["before_state"],
                  after_state: row.after_state as CleanerOperationalAuditRow["after_state"],
                  affected_counts:
                    row.affected_counts as CleanerOperationalAuditRow["affected_counts"],
                  metadata: row.metadata as CleanerOperationalAuditRow["metadata"],
                  idempotency_key: (row.idempotency_key as string | null) ?? null,
                  created_at: new Date().toISOString(),
                };
                state.audits.push(audit);
                return { data: audit, error: null };
              },
            }),
          }),
          select: () => ({
            eq: (_c: string, key: string) => ({
              maybeSingle: async () => {
                const found = state.audits.find((a) => a.idempotency_key === key);
                return { data: found ?? null, error: null };
              },
            }),
          }),
        };
      }
      return from(table);
    },
    rpc: async (name: string) => {
      if (name === "enable_cleaner_lifecycle_column_write") {
        state.rpcCalled = true;
      }
      return { error: null };
    },
  } as unknown as SupabaseClient<Database>;
}

describe("cleaner lifecycle service commands", () => {
  let state: TestState;
  let client: SupabaseClient<Database>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(enableCleanerLifecycleColumnWrite).mockResolvedValue(undefined);
    vi.mocked(countActiveBookingsForCleaner).mockResolvedValue(0);
    state = {
      cleaners: new Map([["cleaner-1", baseCleaner()]]),
      audits: [],
      rpcCalled: false,
    };
    client = createMockLifecycleClient(state);
  });

  it("deactivateCleaner cancels open offers, sets active=false, and writes audit", async () => {
    vi.spyOn(
      await import("./cancelCleanerOpenOffers"),
      "cancelCleanerOpenOffers",
    ).mockResolvedValue({ openOffersCancelled: 2, offersExamined: 2 });

    const result = await deactivateCleaner(
      {
        cleanerId: "cleaner-1",
        adminProfileId: "admin-1",
        reason: "Policy violation",
      },
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.outcome).toBe("success");
    expect(state.cleaners.get("cleaner-1")?.active).toBe(false);
    expect(enableCleanerLifecycleColumnWrite).toHaveBeenCalled();
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]?.action).toBe("deactivated");
    expect(state.audits[0]?.outcome).toBe("success");
    expect(result.affectedCounts.openOffersCancelled).toBe(2);
  });

  it("cancelCleanerOpenOffers cancels offered rows via command path", async () => {
    commandTestBackend = new InMemoryBookingCommandBackend();
    const bookingId = crypto.randomUUID();
    commandTestBackend.bookings.set(bookingId, {
      id: bookingId,
      customer_id: crypto.randomUUID(),
      status: "pending_assignment",
      cleaner_id: null,
      scheduled_start: new Date().toISOString(),
      scheduled_end: new Date(Date.now() + 3600_000).toISOString(),
      price_cents: 1000,
      currency: "ZAR",
      metadata: {},
      assignment_dispatch_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);
    const offer: AssignmentOfferRow = {
      id: crypto.randomUUID(),
      booking_id: bookingId,
      cleaner_id: "cleaner-1",
      status: "offered",
      team_role: "lead",
      roster_id: null,
      offered_at: new Date().toISOString(),
      responded_at: null,
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    commandTestBackend.offers.set(offer.id, offer);

    vi.spyOn(
      await import("@/features/assignments/server/offerRepository"),
      "listOffersForCleaner",
    ).mockResolvedValue([offer]);

    const cancel = await cancelCleanerOpenOffers(client, {
      cleanerId: "cleaner-1",
      adminProfileId: "admin-1",
    });
    expect(cancel.openOffersCancelled).toBe(1);
    expect(commandTestBackend.offers.get(offer.id)?.status).toBe("cancelled");
  });

  it("deactivateCleaner is idempotent when cleaner already inactive", async () => {
    state.cleaners.set("cleaner-1", baseCleaner({ active: false }));

    const result = await deactivateCleaner(
      {
        cleanerId: "cleaner-1",
        adminProfileId: "admin-1",
        reason: "No longer needed",
      },
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.outcome).toBe("idempotent");
    expect(state.audits[0]?.action).toBe("deactivated");
  });

  it("suspendCleaner sets active=false, suspended_at, and cancels offers", async () => {
    vi.spyOn(
      await import("@/features/assignments/server/offerRepository"),
      "listOffersForCleaner",
    ).mockResolvedValue([]);

    const result = await suspendCleaner(
      {
        cleanerId: "cleaner-1",
        adminProfileId: "admin-1",
        reason: "Temporary hold",
        suspensionEndsAt: "2026-06-01T00:00:00.000Z",
      },
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const row = state.cleaners.get("cleaner-1")!;
    expect(row.active).toBe(false);
    expect(row.suspended_at).toBeTruthy();
    expect(row.suspension_ends_at).toBe("2026-06-01T00:00:00.000Z");
    expect(state.audits[0]?.action).toBe("suspended");
  });

  it("unsuspendCleaner clears suspension fields without activating inactive cleaner", async () => {
    state.cleaners.set(
      "cleaner-1",
      baseCleaner({
        active: false,
        suspended_at: "2026-05-18T00:00:00.000Z",
        suspension_ends_at: "2026-06-01T00:00:00.000Z",
      }),
    );

    const result = await unsuspendCleaner(
      { cleanerId: "cleaner-1", adminProfileId: "admin-1" },
      client,
    );

    expect(result.ok).toBe(true);
    const row = state.cleaners.get("cleaner-1")!;
    expect(row.suspended_at).toBeNull();
    expect(row.suspension_ends_at).toBeNull();
    expect(row.active).toBe(false);
    expect(state.audits[0]?.action).toBe("unsuspended");
  });

  it("reactivateCleaner sets active=true when not archived", async () => {
    state.cleaners.set("cleaner-1", baseCleaner({ active: false }));

    const result = await reactivateCleaner(
      { cleanerId: "cleaner-1", adminProfileId: "admin-1" },
      client,
    );

    expect(result.ok).toBe(true);
    expect(state.cleaners.get("cleaner-1")?.active).toBe(true);
    expect(state.audits[0]?.action).toBe("reactivated");
  });

  it("reactivateCleaner rejects archived cleaners", async () => {
    state.cleaners.set(
      "cleaner-1",
      baseCleaner({ deleted_at: "2026-01-01T00:00:00.000Z", active: false }),
    );

    const result = await reactivateCleaner(
      { cleanerId: "cleaner-1", adminProfileId: "admin-1" },
      client,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.code).toBe("CLEANER_ARCHIVED");
    expect(state.audits[0]?.outcome).toBe("rejected");
  });

  it("archiveCleaner soft-deletes and blocks when active bookings exist", async () => {
    vi.mocked(countActiveBookingsForCleaner).mockResolvedValue(1);
    vi.spyOn(
      await import("@/features/assignments/server/offerRepository"),
      "listOffersForCleaner",
    ).mockResolvedValue([]);

    const blocked = await archiveCleaner(
      {
        cleanerId: "cleaner-1",
        adminProfileId: "admin-1",
        reason: "Offboard",
      },
      client,
    );
    expect(blocked.ok).toBe(false);
    if (blocked.ok) throw new Error("expected block");
    expect(blocked.code).toBe("ACTIVE_BOOKINGS_BLOCK");

    vi.mocked(countActiveBookingsForCleaner).mockResolvedValue(0);
    const result = await archiveCleaner(
      {
        cleanerId: "cleaner-1",
        adminProfileId: "admin-1",
        reason: "Offboard",
        idempotencyKey: "archive-unique-key",
      },
      client,
    );
    expect(result.ok).toBe(true);
    expect(state.cleaners.get("cleaner-1")?.deleted_at).toBeTruthy();
    expect(state.cleaners.get("cleaner-1")?.active).toBe(false);
    expect(state.audits.some((a) => a.action === "archived" && a.outcome === "success")).toBe(
      true,
    );
  });

  it("archived cleaner is blocked from new offers by Phase D guard", async () => {
    const backend = new InMemoryBookingCommandBackend();
    backend.setCleanerLifecycle("cleaner-1", {
      active: false,
      suspendedAt: null,
      deletedAt: "2026-01-01T00:00:00.000Z",
      onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
    });
    backend.bookings.set("booking-2", {
      id: "booking-2",
      customer_id: "cust-1",
      status: "pending_assignment",
      cleaner_id: null,
      scheduled_start: new Date().toISOString(),
      scheduled_end: new Date(Date.now() + 3600_000).toISOString(),
      price_cents: 1000,
      currency: "ZAR",
      metadata: {},
      assignment_dispatch_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);

    const offer = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: { actorType: "system", profileId: null },
        bookingId: "booking-2",
        cleanerId: "cleaner-1",
      },
      {},
    );
    expect(offer.ok).toBe(false);
    if (offer.ok) throw new Error("expected guard failure");
    expect(offer.code).toBe("CLEANER_NOT_OPERATIONAL");
  });
});
