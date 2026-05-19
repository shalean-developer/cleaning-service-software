import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  AUDIT_UPDATE_RECORD_FAILED_WARNING,
  customerUpdatedAuditIdempotencyKey,
  hashCustomerUpdatePatch,
} from "./recordCustomerProfileAudit";

type CustomerRow = {
  id: string;
  profile_id: string;
  company_name: string | null;
  phone: string | null;
  notes: string | null;
  updated_at: string;
};

type MockState = {
  customers: CustomerRow[];
  profiles: { id: string; role: string; full_name: string | null }[];
  cleaners: { id: string; profile_id: string }[];
  audits: Record<string, unknown>[];
  idempotencyKeys: Set<string>;
  failAuditInsert: boolean;
  profileUpdates: number;
};

function createMockClient(state: MockState): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      if (table === "customers") {
        return {
          select: (_cols?: string) => ({
            eq: (col: string, value: string) => ({
              maybeSingle: async () => {
                if (col === "id") {
                  const row = state.customers.find((c) => c.id === value) ?? null;
                  return { data: row, error: null };
                }
                return { data: null, error: null };
              },
              single: async () => {
                const row = state.customers.find((c) => c.id === value) ?? null;
                return { data: row, error: row ? null : { message: "not found" } };
              },
            }),
          }),
          update: (patch: Partial<CustomerRow>) => ({
            eq: (_col: string, id: string) => {
              const row = state.customers.find((c) => c.id === id);
              if (!row) {
                return {
                  select: () => ({
                    single: async () => ({ data: null, error: { message: "not found" } }),
                  }),
                };
              }
              if ("profile_id" in patch || "id" in patch) {
                throw new Error("forbidden column update");
              }
              Object.assign(row, patch, { updated_at: "2026-05-20T12:00:00.000Z" });
              return {
                select: () => ({
                  single: async () => ({ data: { ...row }, error: null }),
                }),
              };
            },
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({
                data: state.profiles.find((p) => p.id === id) ?? null,
                error: null,
              }),
            }),
          }),
          update: () => {
            state.profileUpdates += 1;
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === "cleaners") {
        return {
          select: () => ({
            eq: (_col: string, profileId: string) => ({
              maybeSingle: async () => ({
                data: state.cleaners.find((c) => c.profile_id === profileId) ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "customer_operational_audit") {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                if (state.failAuditInsert) {
                  return { data: null, error: { message: "audit failed", code: "XX000" } };
                }
                const key = row.idempotency_key as string | null | undefined;
                if (key && state.idempotencyKeys.has(key)) {
                  return { data: null, error: { message: "dup", code: "23505" } };
                }
                if (key) state.idempotencyKeys.add(key);
                state.audits.push(row);
                return { data: { id: `audit-${state.audits.length}` }, error: null };
              },
            }),
          }),
          select: () => ({
            eq: (_col: string, key: string) => ({
              maybeSingle: async () => {
                if (!state.idempotencyKeys.has(key)) return { data: null, error: null };
                return { data: { id: "audit-existing" }, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

const baseCustomer: CustomerRow = {
  id: "customer-1",
  profile_id: "profile-1",
  company_name: "Acme Co",
  phone: "+27821234567",
  notes: "VIP",
  updated_at: "2026-05-19T10:00:00.000Z",
};

function healthyState(): MockState {
  return {
    customers: [{ ...baseCustomer }],
    profiles: [{ id: "profile-1", role: "customer", full_name: "Ada Customer" }],
    cleaners: [],
    audits: [],
    idempotencyKeys: new Set(),
    failAuditInsert: false,
    profileUpdates: 0,
  };
}

describe("updateCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates company_name only", async () => {
    const state = healthyState();
    const client = createMockClient(state);
    const { updateCustomer } = await import("./updateCustomer");

    const result = await updateCustomer(
      { customerId: "customer-1", adminProfileId: "admin-1", patch: { companyName: "New Co" } },
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(state.customers[0]?.company_name).toBe("New Co");
    expect(state.customers[0]?.phone).toBe("+27821234567");
    expect(state.customers[0]?.notes).toBe("VIP");
    expect(result.customer.companyName).toBe("New Co");
  });

  it("updates phone only", async () => {
    const state = healthyState();
    const client = createMockClient(state);
    const { updateCustomer } = await import("./updateCustomer");

    const result = await updateCustomer(
      {
        customerId: "customer-1",
        adminProfileId: "admin-1",
        patch: { phone: "082 999 8888" },
      },
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(state.customers[0]?.phone).toBe("+27829998888");
    expect(state.customers[0]?.company_name).toBe("Acme Co");
  });

  it("clears notes", async () => {
    const state = healthyState();
    const client = createMockClient(state);
    const { updateCustomer } = await import("./updateCustomer");

    const result = await updateCustomer(
      { customerId: "customer-1", adminProfileId: "admin-1", patch: { notes: null } },
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(state.customers[0]?.notes).toBeNull();
  });

  it("rejects invalid phone", async () => {
    const state = healthyState();
    const client = createMockClient(state);
    const { updateCustomer } = await import("./updateCustomer");

    const result = await updateCustomer(
      { customerId: "customer-1", adminProfileId: "admin-1", patch: { phone: "bad" } },
      client,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_PHONE");
    expect(state.customers[0]?.phone).toBe("+27821234567");
  });

  it("rejects non-customer profile", async () => {
    const state = healthyState();
    state.profiles[0]!.role = "admin";
    const client = createMockClient(state);
    const { updateCustomer } = await import("./updateCustomer");

    const result = await updateCustomer(
      { customerId: "customer-1", adminProfileId: "admin-1", patch: { companyName: "X" } },
      client,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ROLE_CONFLICT");
    expect(state.customers[0]?.company_name).toBe("Acme Co");
  });

  it("rejects dual-domain profile", async () => {
    const state = healthyState();
    state.cleaners.push({ id: "cleaner-1", profile_id: "profile-1" });
    const client = createMockClient(state);
    const { updateCustomer } = await import("./updateCustomer");

    const result = await updateCustomer(
      { customerId: "customer-1", adminProfileId: "admin-1", patch: { companyName: "X" } },
      client,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("DUAL_DOMAIN");
  });

  it("does not update profile or customer identity columns", async () => {
    const state = healthyState();
    const client = createMockClient(state);
    const { updateCustomer } = await import("./updateCustomer");

    await updateCustomer(
      {
        customerId: "customer-1",
        adminProfileId: "admin-1",
        patch: { companyName: "New Co", notes: "Updated" },
      },
      client,
    );

    expect(state.customers[0]?.id).toBe("customer-1");
    expect(state.customers[0]?.profile_id).toBe("profile-1");
    expect(state.profileUpdates).toBe(0);
  });

  it("does not duplicate audit rows for identical patch retries", async () => {
    const state = healthyState();
    const client = createMockClient(state);
    const { updateCustomer } = await import("./updateCustomer");

    const params = {
      customerId: "customer-1",
      adminProfileId: "admin-1",
      patch: { companyName: "Retry Co" },
    };

    await updateCustomer(params, client);
    await updateCustomer(params, client);

    expect(state.audits).toHaveLength(1);
    const patchHash = hashCustomerUpdatePatch({ company_name: "Retry Co" });
    expect(state.idempotencyKeys.has(
      customerUpdatedAuditIdempotencyKey("customer-1", "admin-1", patchHash),
    )).toBe(true);
  });

  it("returns success with warning when audit insert fails", async () => {
    const state = healthyState();
    state.failAuditInsert = true;
    const client = createMockClient(state);
    const { updateCustomer } = await import("./updateCustomer");

    const result = await updateCustomer(
      { customerId: "customer-1", adminProfileId: "admin-1", patch: { companyName: "New Co" } },
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.auditId).toBeNull();
    expect(result.customer.warnings).toContain(AUDIT_UPDATE_RECORD_FAILED_WARNING);
    expect(state.customers[0]?.company_name).toBe("New Co");
  });
});
