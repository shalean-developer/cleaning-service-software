import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

const authAdmin = {
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  updateUserById: vi.fn(),
  listUsers: vi.fn(),
};

type MockState = {
  profiles: { id: string; role: string; full_name: string | null }[];
  cleaners: {
    id: string;
    profile_id: string;
    phone: string | null;
    active?: boolean;
  }[];
};

function createMockClient(state: MockState): SupabaseClient<Database> {
  return {
    auth: { admin: authAdmin },
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
          upsert: (row: { id: string; role: string; full_name: string }) => ({
            then: undefined,
            // vitest doesn't use then; return promise-like via direct async in tests
          }),
        };
      }
      if (table === "cleaners") {
        return {
          select: () => ({
            eq: (col: string, value: string) => ({
              maybeSingle: async () => {
                if (col === "profile_id") {
                  return {
                    data: state.cleaners.find((c) => c.profile_id === value) ?? null,
                    error: null,
                  };
                }
                if (col === "phone") {
                  return {
                    data: state.cleaners.find((c) => c.phone === value) ?? null,
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
            }),
          }),
          insert: (row: { profile_id: string; phone: string; active?: boolean }) => ({
            select: () => ({
              single: async () => {
                const id = `cleaner-${state.cleaners.length + 1}`;
                state.cleaners.push({
                  id,
                  profile_id: row.profile_id,
                  phone: row.phone,
                  active: row.active,
                });
                return { data: { id }, error: null };
              },
            }),
          }),
          update: (patch: { phone: string }) => ({
            eq: async () => {
              const cleaner = state.cleaners[0];
              if (cleaner) cleaner.phone = patch.phone;
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

// Wire upsert/insert to mutate state (profiles/cleaners builders above are stubs. patch client)
function createStatefulClient(state: MockState): SupabaseClient<Database> {
  const base = createMockClient(state);
  const originalFrom = base.from.bind(base);
  base.from = ((table: string) => {
    const api = originalFrom(table);
    if (table === "profiles") {
      return {
        ...api,
        upsert: async (row: { id: string; role: string; full_name: string }) => {
          const idx = state.profiles.findIndex((p) => p.id === row.id);
          if (idx >= 0) {
            state.profiles[idx] = { ...state.profiles[idx], ...row };
          } else {
            state.profiles.push(row);
          }
          return { error: null };
        },
      };
    }
    if (table === "cleaners") {
      return {
        ...api,
        insert: (row: { profile_id: string; phone: string; active?: boolean }) => ({
          select: () => ({
            single: async () => {
              const id = `cleaner-${state.cleaners.length + 1}`;
              state.cleaners.push({
                id,
                profile_id: row.profile_id,
                phone: row.phone,
                active: row.active,
              });
              return { data: { id }, error: null };
            },
          }),
        }),
      };
    }
    return api;
  }) as typeof base.from;
  return base;
}

describe("provisionCleanerIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authAdmin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    authAdmin.createUser.mockResolvedValue({
      data: { user: { id: "profile-new", email: "0792022648@shalean.co.za" } },
      error: null,
    });
    authAdmin.deleteUser.mockResolvedValue({ error: null });
    authAdmin.updateUserById.mockResolvedValue({ data: {}, error: null });
  });

  it("provisions new auth user, profile, and cleaners row", async () => {
    const state: MockState = { profiles: [], cleaners: [] };
    const client = createStatefulClient(state);
    const { provisionCleanerIdentity } = await import("./provisionCleanerIdentity");

    const result = await provisionCleanerIdentity(client, {
      authEmail: "0792022648@shalean.co.za",
      fullName: "Ada Cleaner",
      phoneE164: "+27792022648",
      password: "secure-pass-1",
    });

    expect(result).toEqual({
      ok: true,
      profileId: "profile-new",
      cleanerId: "cleaner-1",
      createdAuthUser: true,
    });
    expect(state.profiles).toEqual([
      { id: "profile-new", role: "cleaner", full_name: "Ada Cleaner" },
    ]);
    expect(state.cleaners[0]).toMatchObject({
      profile_id: "profile-new",
      phone: "+27792022648",
      active: false,
    });
    expect(authAdmin.createUser).toHaveBeenCalled();
  });

  it("returns EMAIL_ALREADY_REGISTERED when cleaner row exists for auth user", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: {
        users: [{ id: "profile-existing", email: "0792022648@shalean.co.za" }],
      },
      error: null,
    });
    const state: MockState = {
      profiles: [{ id: "profile-existing", role: "cleaner", full_name: "Existing" }],
      cleaners: [
        { id: "cleaner-1", profile_id: "profile-existing", phone: "+27790000000" },
      ],
    };
    const client = createStatefulClient(state);
    const { provisionCleanerIdentity } = await import("./provisionCleanerIdentity");

    const result = await provisionCleanerIdentity(client, {
      authEmail: "0792022648@shalean.co.za",
      fullName: "Ada Cleaner",
      phoneE164: "+27792022648",
      password: "secure-pass-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("EMAIL_ALREADY_REGISTERED");
    expect(authAdmin.createUser).not.toHaveBeenCalled();
  });

  it("upserts profile and inserts cleaners when auth exists but profile is missing", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: {
        users: [{ id: "orphan-auth", email: "chitekedzaf@gmail.com" }],
      },
      error: null,
    });
    const state: MockState = { profiles: [], cleaners: [] };
    const client = createStatefulClient(state);
    const { provisionCleanerIdentity } = await import("./provisionCleanerIdentity");

    const result = await provisionCleanerIdentity(client, {
      authEmail: "chitekedzaf@gmail.com",
      fullName: "Chitekedza F",
      phoneE164: "+27791111111",
      password: "secure-pass-1",
    });

    expect(result).toEqual({
      ok: true,
      profileId: "orphan-auth",
      cleanerId: "cleaner-1",
      createdAuthUser: false,
    });
    expect(state.profiles[0]?.role).toBe("cleaner");
    expect(state.cleaners[0]?.profile_id).toBe("orphan-auth");
    expect(authAdmin.updateUserById).toHaveBeenCalledWith(
      "orphan-auth",
      expect.objectContaining({ password: "secure-pass-1" }),
    );
  });

  it("inserts cleaners row when profile exists but cleaner link is missing", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: {
        users: [{ id: "profile-only", email: "0792022648@shalean.co.za" }],
      },
      error: null,
    });
    const state: MockState = {
      profiles: [{ id: "profile-only", role: "customer", full_name: "Stale" }],
      cleaners: [],
    };
    const client = createStatefulClient(state);
    const { provisionCleanerIdentity } = await import("./provisionCleanerIdentity");

    const result = await provisionCleanerIdentity(client, {
      authEmail: "0792022648@shalean.co.za",
      fullName: "Ada Cleaner",
      phoneE164: "+27792022648",
      password: "secure-pass-1",
    });

    expect(result.ok).toBe(true);
    expect(state.profiles[0]?.role).toBe("cleaner");
    expect(state.cleaners).toHaveLength(1);
  });

  it("never modifies an admin profile", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: { users: [{ id: "admin-auth", email: "admin@shalean.com" }] },
      error: null,
    });
    const state: MockState = {
      profiles: [{ id: "admin-auth", role: "admin", full_name: "Admin" }],
      cleaners: [],
    };
    const client = createStatefulClient(state);
    const { provisionCleanerIdentity } = await import("./provisionCleanerIdentity");

    const result = await provisionCleanerIdentity(client, {
      authEmail: "admin@shalean.com",
      fullName: "Hacker",
      phoneE164: "+27792022648",
      password: "secure-pass-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("EMAIL_ALREADY_REGISTERED");
    expect(state.profiles[0]?.role).toBe("admin");
    expect(state.cleaners).toHaveLength(0);
  });
});

describe("repairCleanerAuthIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authAdmin.listUsers.mockResolvedValue({
      data: { users: [{ id: "orphan-auth", email: "chitekedzaf@gmail.com" }] },
      error: null,
    });
  });

  it("refuses admin accounts", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: { users: [{ id: "admin-auth", email: "admin@shalean.com" }] },
      error: null,
    });
    const state: MockState = {
      profiles: [{ id: "admin-auth", role: "admin", full_name: "Admin" }],
      cleaners: [],
    };
    const client = createStatefulClient(state);
    const { repairCleanerAuthIdentity } = await import("./provisionCleanerIdentity");

    const result = await repairCleanerAuthIdentity(client, {
      authEmail: "admin@shalean.com",
      allowCreateCleanerRow: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
  });
});
