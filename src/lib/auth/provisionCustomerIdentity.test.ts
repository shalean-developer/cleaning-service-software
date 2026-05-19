import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

const authAdmin = {
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  listUsers: vi.fn(),
};

type MockState = {
  profiles: { id: string; role: string; full_name: string | null }[];
  customers: {
    id: string;
    profile_id: string;
    company_name: string | null;
    phone: string | null;
    notes: string | null;
  }[];
  cleaners: { id: string; profile_id: string }[];
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
};

function createStatefulClient(state: MockState): SupabaseClient<Database> {
  let customerSeq = 0;

  return {
    auth: { admin: authAdmin },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      if (fn === "ensure_customer_provisioned") {
        const profileId = args.profile_id as string;
        const existing = state.customers.find((c) => c.profile_id === profileId);
        if (existing) {
          return { data: existing.id, error: null };
        }
        customerSeq += 1;
        const id = `customer-${customerSeq}`;
        const profile = state.profiles.find((p) => p.id === profileId);
        state.customers.push({
          id,
          profile_id: profileId,
          company_name: profile?.full_name ?? "Customer",
          phone: null,
          notes: null,
        });
        return { data: id, error: null };
      }
      return { data: null, error: { message: `Unknown rpc ${fn}` } };
    },
    from: (table: string) => {
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
          insert: async (row: { id: string; role: string; full_name: string }) => {
            state.profiles.push(row);
            return { error: null };
          },
          upsert: async (row: { id: string; role: string; full_name: string }) => {
            const idx = state.profiles.findIndex((p) => p.id === row.id);
            if (idx >= 0) {
              state.profiles[idx] = { ...state.profiles[idx], ...row };
            } else {
              state.profiles.push(row);
            }
            return { error: null };
          },
          update: (row: { role?: string; full_name?: string }) => ({
            eq: async (_col: string, id: string) => {
              const idx = state.profiles.findIndex((p) => p.id === id);
              if (idx >= 0) {
                state.profiles[idx] = { ...state.profiles[idx], ...row };
              }
              return { error: null };
            },
          }),
        };
      }
      if (table === "customers") {
        return {
          select: () => ({
            eq: (col: string, value: string) => ({
              maybeSingle: async () => {
                if (col === "profile_id") {
                  return {
                    data: state.customers.find((c) => c.profile_id === value) ?? null,
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
            }),
          }),
          update: (patch: {
            company_name?: string;
            phone?: string | null;
            notes?: string | null;
          }) => ({
            eq: async (_col: string, id: string) => {
              const row = state.customers.find((c) => c.id === id);
              if (row) Object.assign(row, patch);
              return { error: null };
            },
          }),
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
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

describe("provisionCustomerIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authAdmin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    authAdmin.createUser.mockResolvedValue({
      data: { user: { id: "profile-new", email: "ada@example.com" } },
      error: null,
    });
    authAdmin.deleteUser.mockResolvedValue({ error: null });
  });

  it("creates new auth user, profile, and customers row", async () => {
    const state: MockState = { profiles: [], customers: [], cleaners: [], rpcCalls: [] };
    const client = createStatefulClient(state);
    const { provisionCustomerIdentity } = await import("./provisionCustomerIdentity");

    const result = await provisionCustomerIdentity(client, {
      authEmail: "ada@example.com",
      fullName: "Ada Customer",
      companyName: "Ada Co",
      phoneE164: "+27821234567",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.createdAuthUser).toBe(true);
    expect(result.createdProfile).toBe(true);
    expect(result.createdCustomer).toBe(true);
    expect(result.email).toBe("ada@example.com");
    expect(state.profiles[0]).toMatchObject({
      id: "profile-new",
      role: "customer",
      full_name: "Ada Customer",
    });
    expect(state.customers[0]).toMatchObject({
      profile_id: "profile-new",
      company_name: "Ada Co",
      phone: "+27821234567",
    });
    expect(state.cleaners).toHaveLength(0);
    expect(state.rpcCalls[0]?.fn).toBe("ensure_customer_provisioned");
    expect(authAdmin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ada@example.com", email_confirm: true }),
    );
  });

  it("is read-only when customer already exists for email", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: { users: [{ id: "profile-existing", email: "existing@example.com" }] },
      error: null,
    });
    const state: MockState = {
      profiles: [{ id: "profile-existing", role: "customer", full_name: "Existing" }],
      customers: [
        {
          id: "customer-1",
          profile_id: "profile-existing",
          company_name: "Existing Co",
          phone: "+27820000000",
          notes: "Original notes",
        },
      ],
      cleaners: [],
      rpcCalls: [],
    };
    const client = createStatefulClient(state);
    const { provisionCustomerIdentity } = await import("./provisionCustomerIdentity");

    const result = await provisionCustomerIdentity(client, {
      authEmail: "existing@example.com",
      fullName: "Existing Updated",
      companyName: "Overwrite Co",
      phoneE164: "+27829999999",
      notes: "Overwrite notes",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.customerId).toBe("customer-1");
    expect(result.createdAuthUser).toBe(false);
    expect(result.createdCustomer).toBe(false);
    expect(result.warnings).toEqual(["Customer already exists"]);
    expect(state.rpcCalls).toHaveLength(0);
    expect(authAdmin.createUser).not.toHaveBeenCalled();
    expect(state.profiles[0]?.full_name).toBe("Existing");
    expect(state.customers[0]).toMatchObject({
      company_name: "Existing Co",
      phone: "+27820000000",
      notes: "Original notes",
    });
  });

  it("rejects existing admin email", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: { users: [{ id: "admin-auth", email: "admin@shalean.com" }] },
      error: null,
    });
    const state: MockState = {
      profiles: [{ id: "admin-auth", role: "admin", full_name: "Admin" }],
      customers: [],
      cleaners: [],
      rpcCalls: [],
    };
    const client = createStatefulClient(state);
    const { provisionCustomerIdentity } = await import("./provisionCustomerIdentity");

    const result = await provisionCustomerIdentity(client, {
      authEmail: "admin@shalean.com",
      fullName: "Hacker",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ROLE_CONFLICT");
    expect(state.customers).toHaveLength(0);
  });

  it("rejects existing cleaner email", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: { users: [{ id: "cleaner-auth", email: "cleaner@shalean.com" }] },
      error: null,
    });
    const state: MockState = {
      profiles: [{ id: "cleaner-auth", role: "cleaner", full_name: "Cleaner" }],
      customers: [],
      cleaners: [{ id: "cleaner-1", profile_id: "cleaner-auth" }],
      rpcCalls: [],
    };
    const client = createStatefulClient(state);
    const { provisionCustomerIdentity } = await import("./provisionCustomerIdentity");

    const result = await provisionCustomerIdentity(client, {
      authEmail: "cleaner@shalean.com",
      fullName: "Not Customer",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ROLE_CONFLICT");
    expect(state.customers).toHaveLength(0);
  });

  it("does not create a cleaners row", async () => {
    const state: MockState = { profiles: [], customers: [], cleaners: [], rpcCalls: [] };
    const client = createStatefulClient(state);
    const { provisionCustomerIdentity } = await import("./provisionCustomerIdentity");

    await provisionCustomerIdentity(client, {
      authEmail: "new@example.com",
      fullName: "New Customer",
    });

    expect(state.cleaners).toHaveLength(0);
    expect(state.profiles.every((p) => p.role === "customer")).toBe(true);
  });
});
