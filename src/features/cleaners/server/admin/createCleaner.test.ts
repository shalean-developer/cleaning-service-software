import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

const authAdmin = {
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  listUsers: vi.fn(),
};

type CreateCleanerMockOptions = {
  failProfileUpdate?: boolean;
};

function createMockClient(
  state: {
    profiles: { id: string; role: string; full_name: string | null }[];
    cleaners: { id: string; profile_id: string; phone: string | null }[];
    capabilities: { cleaner_id: string; service_slug: string }[];
    areas: { cleaner_id: string; area_slug: string }[];
    audits: Record<string, unknown>[];
  },
  options: CreateCleanerMockOptions = {},
): SupabaseClient<Database> {
  return {
    auth: { admin: authAdmin },
    from: (table: string) => {
      const api = {
        select: () => api,
        eq: () => api,
        limit: () => api,
        insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(rows) ? rows : [rows];
          if (table === "cleaners") {
            const row = {
              id: "cleaner-new",
              profile_id: list[0]!.profile_id as string,
              phone: list[0]!.phone as string,
            };
            state.cleaners.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            };
          }
          if (table === "cleaner_service_capabilities") {
            for (const row of list) {
              state.capabilities.push({
                cleaner_id: row.cleaner_id as string,
                service_slug: row.service_slug as string,
              });
            }
          }
          if (table === "cleaner_service_areas") {
            for (const row of list) {
              state.areas.push({
                cleaner_id: row.cleaner_id as string,
                area_slug: row.area_slug as string,
              });
            }
          }
          if (table === "cleaner_operational_audit") {
            state.audits.push(list[0] ?? {});
            return {
              select: () => ({
                single: async () => ({ data: { id: "audit-1" }, error: null }),
              }),
            };
          }
          return api;
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async () => {
            if (table === "profiles" && options.failProfileUpdate) {
              return { error: { message: "Profile update failed" } };
            }
            if (table === "profiles") {
              const profile = state.profiles[0];
              if (profile) {
                Object.assign(profile, patch);
              }
            }
            return { error: null };
          },
        }),
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
        maybeSingle: async () => ({ data: null, error: null }),
      };
      if (table === "cleaners") {
        return {
          ...api,
          select: () => ({
            eq: () => ({
              limit: async () => ({ data: state.cleaners, error: null }),
            }),
          }),
        };
      }
      return api;
    },
  } as unknown as SupabaseClient<Database>;
}

describe("createCleaner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authAdmin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    authAdmin.createUser.mockResolvedValue({
      data: { user: { id: "profile-new" } },
      error: null,
    });
    authAdmin.deleteUser.mockResolvedValue({ error: null });
  });

  it("creates auth user, cleaner row, children, and audit without password in metadata", async () => {
    const state = {
      profiles: [{ id: "profile-new", role: "customer", full_name: null }],
      cleaners: [] as { id: string; profile_id: string; phone: string | null }[],
      capabilities: [] as { cleaner_id: string; service_slug: string }[],
      areas: [] as { cleaner_id: string; area_slug: string }[],
      audits: [] as Record<string, unknown>[],
    };
    const client = createMockClient(state);

    const { createCleaner } = await import("./createCleaner");
    const result = await createCleaner(
      {
        adminProfileId: "admin-1",
        fullName: "Ada Cleaner",
        phone: "0792022648",
        password: "secure-pass-1",
        confirmPassword: "secure-pass-1",
        serviceAreasInput: "Sea Point",
        capabilities: ["regular-cleaning"],
      },
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.cleanerId).toBe("cleaner-new");
    expect(state.cleaners[0]?.phone).toBe("+27792022648");
    expect(authAdmin.createUser).toHaveBeenCalledWith({
      email: "0792022648@shalean.co.za",
      password: "secure-pass-1",
      email_confirm: true,
      user_metadata: { full_name: "Ada Cleaner" },
    });

    const audit = state.audits[0] as { metadata?: Record<string, unknown> };
    expect(audit.metadata?.authEmail).toBe("0792022648@shalean.co.za");
    expect(audit.metadata).not.toHaveProperty("password");
    expect(audit.metadata).not.toHaveProperty("confirmPassword");
    expect(JSON.stringify(state.audits)).not.toContain("secure-pass");
  });

  it("never stores password in profile_created audit metadata", async () => {
    const state = {
      profiles: [{ id: "profile-new", role: "customer", full_name: null }],
      cleaners: [] as { id: string; profile_id: string; phone: string | null }[],
      capabilities: [] as { cleaner_id: string; service_slug: string }[],
      areas: [] as { cleaner_id: string; area_slug: string }[],
      audits: [] as Record<string, unknown>[],
    };
    const client = createMockClient(state);

    const { createCleaner } = await import("./createCleaner");
    await createCleaner(
      {
        adminProfileId: "admin-1",
        fullName: "Ada Cleaner",
        phone: "0792022648",
        password: "super-secret-pass",
        confirmPassword: "super-secret-pass",
        serviceAreasInput: "",
        capabilities: ["regular-cleaning"],
      },
      client,
    );

    for (const row of state.audits) {
      const serialized = JSON.stringify(row);
      expect(serialized).not.toContain("super-secret-pass");
      expect(serialized).not.toMatch(/"password"/i);
      expect(serialized).not.toMatch(/"confirmPassword"/i);
    }
  });

  it("returns PHONE_ALREADY_REGISTERED when cleaners.phone already exists", async () => {
    const { createCleaner } = await import("./createCleaner");
    const result = await createCleaner(
      {
        adminProfileId: "admin-1",
        fullName: "Ada Cleaner",
        phone: "0792022648",
        password: "secure-pass-1",
        confirmPassword: "secure-pass-1",
        serviceAreasInput: "",
        capabilities: ["regular-cleaning"],
      },
      createMockClient({
        profiles: [],
        cleaners: [
          {
            id: "cleaner-existing",
            profile_id: "profile-existing",
            phone: "+27792022648",
          },
        ],
        capabilities: [],
        areas: [],
        audits: [],
      }),
    );

    expect(result).toEqual({
      ok: false,
      code: "PHONE_ALREADY_REGISTERED",
      message: "A cleaner with this phone number already exists.",
    });
    expect(authAdmin.createUser).not.toHaveBeenCalled();
  });

  it("maps PHONE_ALREADY_REGISTERED to HTTP 409", async () => {
    const { mapCreateCleanerHttpStatus } = await import("./mapCreateCleanerHttpStatus");
    expect(
      mapCreateCleanerHttpStatus({
        ok: false,
        code: "PHONE_ALREADY_REGISTERED",
        message: "A cleaner with this phone number already exists.",
      }),
    ).toBe(409);
  });

  it("calls deleteUser when provisioning fails after auth user creation", async () => {
    const state = {
      profiles: [{ id: "profile-new", role: "customer", full_name: null }],
      cleaners: [] as { id: string; profile_id: string; phone: string | null }[],
      capabilities: [] as { cleaner_id: string; service_slug: string }[],
      areas: [] as { cleaner_id: string; area_slug: string }[],
      audits: [] as Record<string, unknown>[],
    };

    const { createCleaner } = await import("./createCleaner");
    const result = await createCleaner(
      {
        adminProfileId: "admin-1",
        fullName: "Ada Cleaner",
        phone: "0792022648",
        password: "secure-pass-1",
        confirmPassword: "secure-pass-1",
        serviceAreasInput: "",
        capabilities: ["regular-cleaning"],
      },
      createMockClient(state, { failProfileUpdate: true }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PROVISION_FAILED");
    expect(authAdmin.createUser).toHaveBeenCalledOnce();
    expect(authAdmin.deleteUser).toHaveBeenCalledWith("profile-new");
    expect(state.cleaners).toHaveLength(0);
  });

  it("returns 409 when auth email already exists", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: { users: [{ email: "0792022648@shalean.co.za" }] },
      error: null,
    });

    const { createCleaner } = await import("./createCleaner");
    const result = await createCleaner(
      {
        adminProfileId: "admin-1",
        fullName: "Ada Cleaner",
        phone: "0792022648",
        password: "secure-pass-1",
        confirmPassword: "secure-pass-1",
        serviceAreasInput: "",
        capabilities: ["regular-cleaning"],
      },
      createMockClient({
        profiles: [],
        cleaners: [],
        capabilities: [],
        areas: [],
        audits: [],
      }),
    );

    expect(result).toEqual({
      ok: false,
      code: "EMAIL_ALREADY_REGISTERED",
      message: "A cleaner account with this phone number already exists.",
    });
    expect(authAdmin.createUser).not.toHaveBeenCalled();
  });

  it("returns validation error for mismatched passwords", async () => {
    const { createCleaner } = await import("./createCleaner");
    const result = await createCleaner(
      {
        adminProfileId: "admin-1",
        fullName: "Ada Cleaner",
        phone: "0792022648",
        password: "secure-pass-1",
        confirmPassword: "other-pass-1",
        serviceAreasInput: "",
        capabilities: ["regular-cleaning"],
      },
      createMockClient({
        profiles: [],
        cleaners: [],
        capabilities: [],
        areas: [],
        audits: [],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_PAYLOAD");
    expect(authAdmin.createUser).not.toHaveBeenCalled();
  });

  it("rejects lifecycle fields in payload", async () => {
    const { parseCreateCleanerBody } = await import("./parseCreateCleanerBody");
    const parsed = parseCreateCleanerBody({
      fullName: "Ada",
      phone: "0792022648",
      password: "secure-pass-1",
      confirmPassword: "secure-pass-1",
      capabilities: ["regular-cleaning"],
      active: false,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toMatch(/lifecycle/i);
  });
});
