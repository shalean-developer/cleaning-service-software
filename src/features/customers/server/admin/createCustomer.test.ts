import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  AUDIT_RECORD_FAILED_WARNING,
  customerCreatedAuditIdempotencyKey,
} from "./recordCustomerProfileAudit";

const provisionCustomerIdentityMock = vi.fn();

vi.mock("@/lib/auth/provisionCustomerIdentity", () => ({
  provisionCustomerIdentity: (...args: unknown[]) => provisionCustomerIdentityMock(...args),
}));

type AuditState = {
  audits: Record<string, unknown>[];
  idempotencyKeys: Set<string>;
  failInsert: boolean;
};

function createMockClient(state: AuditState): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      if (table === "customers") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  company_name: "Ada Co",
                  phone: "+27821234567",
                  notes: "VIP",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { full_name: "Ada Customer" },
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
                if (state.failInsert) {
                  return { data: null, error: { message: "audit insert failed", code: "XX000" } };
                }
                const key = row.idempotency_key as string | null | undefined;
                if (key && state.idempotencyKeys.has(key)) {
                  return {
                    data: null,
                    error: { message: "duplicate key", code: "23505" },
                  };
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
                if (!state.idempotencyKeys.has(key)) {
                  return { data: null, error: null };
                }
                const index = [...state.idempotencyKeys].indexOf(key);
                return { data: { id: `audit-${index + 1}` }, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

describe("createCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    provisionCustomerIdentityMock.mockResolvedValue({
      ok: true,
      customerId: "customer-1",
      profileId: "profile-1",
      email: "ada@example.com",
      createdAuthUser: true,
      createdProfile: true,
      createdCustomer: true,
      warnings: [],
    });
  });

  it("returns customer payload and records customer_created audit", async () => {
    const state: AuditState = { audits: [], idempotencyKeys: new Set(), failInsert: false };
    const client = createMockClient(state);
    const { createCustomer } = await import("./createCustomer");

    const result = await createCustomer(
      {
        adminProfileId: "admin-1",
        email: "ada@example.com",
        fullName: "Ada Customer",
        companyName: "Ada Co",
        phone: "082 123 4567",
        notes: "VIP",
      },
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.customer.customerId).toBe("customer-1");
    expect(result.auditId).toBe("audit-1");
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      action: "customer_created",
      customer_id: "customer-1",
      admin_profile_id: "admin-1",
      idempotency_key: customerCreatedAuditIdempotencyKey("customer-1", "admin-1"),
    });
    const metadata = state.audits[0]?.metadata as Record<string, unknown>;
    expect(metadata.createdAuthUser).toBe(true);
    expect(metadata.email).toBe("ada@example.com");
  });

  it("does not duplicate audit rows on repeated create for same customer and admin", async () => {
    provisionCustomerIdentityMock.mockResolvedValue({
      ok: true,
      customerId: "customer-1",
      profileId: "profile-1",
      email: "existing@example.com",
      createdAuthUser: false,
      createdProfile: false,
      createdCustomer: false,
      warnings: ["Customer already exists"],
    });

    const state: AuditState = { audits: [], idempotencyKeys: new Set(), failInsert: false };
    const client = createMockClient(state);
    const { createCustomer } = await import("./createCustomer");

    const params = {
      adminProfileId: "admin-1",
      email: "existing@example.com",
      fullName: "Overwrite Name",
    };

    const first = await createCustomer(params, client);
    const second = await createCustomer(params, client);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.idempotent).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(state.audits).toHaveLength(1);
    expect(state.idempotencyKeys.size).toBe(1);
  });

  it("returns success with audit warning when audit insert fails after provision", async () => {
    const state: AuditState = { audits: [], idempotencyKeys: new Set(), failInsert: true };
    const client = createMockClient(state);
    const { createCustomer } = await import("./createCustomer");

    const result = await createCustomer(
      {
        adminProfileId: "admin-1",
        email: "ada@example.com",
        fullName: "Ada Customer",
      },
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.auditId).toBeNull();
    expect(result.customer.warnings).toContain(AUDIT_RECORD_FAILED_WARNING);
    expect(state.audits).toHaveLength(0);
  });

  it("returns 400-class code for invalid phone", async () => {
    const state: AuditState = { audits: [], idempotencyKeys: new Set(), failInsert: false };
    const client = createMockClient(state);
    const { createCustomer } = await import("./createCustomer");

    const result = await createCustomer(
      {
        adminProfileId: "admin-1",
        email: "ada@example.com",
        fullName: "Ada Customer",
        phone: "not-a-phone",
      },
      client,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_PHONE");
    expect(provisionCustomerIdentityMock).not.toHaveBeenCalled();
  });

  it("maps provision role conflicts", async () => {
    provisionCustomerIdentityMock.mockResolvedValue({
      ok: false,
      code: "ROLE_CONFLICT",
      message: "Cleaner account.",
    });
    const state: AuditState = { audits: [], idempotencyKeys: new Set(), failInsert: false };
    const client = createMockClient(state);
    const { createCustomer } = await import("./createCustomer");

    const result = await createCustomer(
      {
        adminProfileId: "admin-1",
        email: "cleaner@example.com",
        fullName: "X",
      },
      client,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ROLE_CONFLICT");
  });
});
