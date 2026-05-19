import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CleanerOperationalAuditRow, CleanerRow, Database } from "@/lib/database/types";
import { resolveCleanerOperationalState } from "./operationalState";

vi.mock("./enableLifecycleColumnWrite", () => ({
  enableCleanerLifecycleColumnWrite: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lifecycleQueries", () => ({
  countActiveBookingsForCleaner: vi.fn().mockResolvedValue(0),
  countPendingEarningsForCleaner: vi.fn().mockResolvedValue(0),
}));

type TestState = {
  cleaners: Map<string, CleanerRow>;
  audits: CleanerOperationalAuditRow[];
};

function baseCleaner(overrides: Partial<CleanerRow> = {}): CleanerRow {
  const now = "2026-05-19T12:00:00.000Z";
  return {
    id: "cleaner-1",
    profile_id: "profile-1",
    phone: "+27792022648",
    active: true,
    suspended_at: null,
    deleted_at: null,
    onboarding_completed_at: null,
    suspension_ends_at: null,
    lifecycle_reason: null,
    average_rating: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function createMockClient(state: TestState, cleanerId = "cleaner-1"): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      const api = {
        select: () => api,
        eq: (col: string, val: string) => {
          if (table === "cleaners" && col === "id") {
            return {
              maybeSingle: async () => ({
                data: state.cleaners.get(val) ?? null,
                error: null,
              }),
              single: async () => ({
                data: state.cleaners.get(val) ?? null,
                error: null,
              }),
            };
          }
          if (table === "cleaner_operational_audit") {
            return {
              maybeSingle: async () => ({ data: state.audits[0] ?? null, error: null }),
            };
          }
          return api;
        },
        update: (patch: Record<string, unknown>) => ({
          eq: (_col: string, val: string) => ({
            select: () => ({
              single: async () => {
                if (table === "cleaners") {
                  const row = state.cleaners.get(val);
                  if (row) {
                    const updated = { ...row, ...patch, updated_at: new Date().toISOString() };
                    state.cleaners.set(val, updated as CleanerRow);
                    return { data: updated, error: null };
                  }
                }
                return { data: null, error: { message: "not found" } };
              },
            }),
          }),
        }),
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              if (table === "cleaner_operational_audit") {
                const audit = {
                  id: "audit-onboarding",
                  ...(row as object),
                } as CleanerOperationalAuditRow;
                state.audits.push(audit);
                return { data: audit, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      };
      return api;
    },
    rpc: vi.fn().mockResolvedValue({ error: null }),
  } as unknown as SupabaseClient<Database>;
}

describe("completeCleanerOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets onboarding_completed_at and resolves operational state to active", async () => {
    const state: TestState = {
      cleaners: new Map([["cleaner-1", baseCleaner()]]),
      audits: [],
    };
    const client = createMockClient(state);

    const { completeCleanerOnboarding } = await import("./completeCleanerOnboarding");
    const result = await completeCleanerOnboarding(
      { cleanerId: "cleaner-1", adminProfileId: "admin-1" },
      client,
    );

    expect(result.ok).toBe(true);
    const row = state.cleaners.get("cleaner-1")!;
    expect(row.onboarding_completed_at).not.toBeNull();
    expect(row.active).toBe(true);

    expect(
      resolveCleanerOperationalState({
        active: row.active,
        suspendedAt: row.suspended_at,
        deletedAt: row.deleted_at,
        onboardingCompletedAt: row.onboarding_completed_at,
      }),
    ).toBe("active");

    expect(state.audits[0]?.action).toBe("onboarding_completed");
  });

  it("is idempotent when onboarding already completed", async () => {
    const state: TestState = {
      cleaners: new Map([
        [
          "cleaner-1",
          baseCleaner({ onboarding_completed_at: "2025-01-01T00:00:00.000Z" }),
        ],
      ]),
      audits: [],
    };
    const client = createMockClient(state);

    const { completeCleanerOnboarding } = await import("./completeCleanerOnboarding");
    const result = await completeCleanerOnboarding(
      { cleanerId: "cleaner-1", adminProfileId: "admin-1" },
      client,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome).toBe("idempotent");
    }
  });
});
