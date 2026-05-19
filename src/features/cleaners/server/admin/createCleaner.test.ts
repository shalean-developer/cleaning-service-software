import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { defaultCleanerAvailabilityFormValues } from "@/features/cleaners/admin/cleanerAvailability";

const provisionCleanerIdentityMock = vi.fn();

vi.mock("@/lib/auth/provisionCleanerIdentity", () => ({
  provisionCleanerIdentity: (...args: unknown[]) => provisionCleanerIdentityMock(...args),
}));

type CreateCleanerMockOptions = {
  failCapabilitiesInsert?: boolean;
};

function createMockClient(
  state: {
    capabilities: { cleaner_id: string; service_slug: string }[];
    areas: { cleaner_id: string; area_slug: string }[];
    availability: {
      cleaner_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      timezone: string;
    }[];
    audits: Record<string, unknown>[];
  },
  options: CreateCleanerMockOptions = {},
): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      const api = {
        select: () => api,
        eq: () => api,
        insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(rows) ? rows : [rows];
          const plainResult = Promise.resolve({ error: null as { message: string } | null });

          if (table === "cleaner_service_capabilities") {
            if (options.failCapabilitiesInsert) {
              return Promise.resolve({ error: { message: "Capability insert failed" } });
            }
            for (const row of list) {
              state.capabilities.push({
                cleaner_id: row.cleaner_id as string,
                service_slug: row.service_slug as string,
              });
            }
            return plainResult;
          }
          if (table === "cleaner_service_areas") {
            for (const row of list) {
              state.areas.push({
                cleaner_id: row.cleaner_id as string,
                area_slug: row.area_slug as string,
              });
            }
            return plainResult;
          }
          if (table === "cleaner_availability") {
            for (const row of list) {
              state.availability.push({
                cleaner_id: row.cleaner_id as string,
                day_of_week: row.day_of_week as number,
                start_time: row.start_time as string,
                end_time: row.end_time as string,
                timezone: row.timezone as string,
              });
            }
            return plainResult;
          }
          if (table === "cleaner_operational_audit") {
            state.audits.push(list[0] ?? {});
            return {
              select: () => ({
                single: async () => ({ data: { id: "audit-1" }, error: null }),
              }),
            };
          }
          return plainResult;
        },
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
      };
      return api;
    },
    auth: {
      admin: {
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  } as unknown as SupabaseClient<Database>;
}

const defaultAvailability = defaultCleanerAvailabilityFormValues();

function baseCreateParams(
  overrides: Partial<{
    adminProfileId: string;
    fullName: string;
    phone: string;
    password: string;
    confirmPassword: string;
    serviceAreasInput: string;
    capabilities: string[];
  }> = {},
) {
  return {
    adminProfileId: "admin-1",
    fullName: "Ada Cleaner",
    phone: "0792022648",
    password: "secure-pass-1",
    confirmPassword: "secure-pass-1",
    serviceAreasInput: "",
    capabilities: ["regular-cleaning"] as const,
    workingDays: defaultAvailability.workingDays,
    startTime: defaultAvailability.startTime,
    endTime: defaultAvailability.endTime,
    timezone: defaultAvailability.timezone,
    ...overrides,
  };
}

describe("createCleaner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    provisionCleanerIdentityMock.mockResolvedValue({
      ok: true,
      profileId: "profile-new",
      cleanerId: "cleaner-new",
      createdAuthUser: true,
    });
  });

  it("creates cleaner children and audit after identity provisioning", async () => {
    const state = {
      capabilities: [] as { cleaner_id: string; service_slug: string }[],
      areas: [] as { cleaner_id: string; area_slug: string }[],
      availability: [] as {
        cleaner_id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        timezone: string;
      }[],
      audits: [] as Record<string, unknown>[],
    };
    const client = createMockClient(state);

    const { createCleaner } = await import("./createCleaner");
    const result = await createCleaner(
      {
        ...baseCreateParams(),
        serviceAreasInput: "Sea Point",
      },
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.cleanerId).toBe("cleaner-new");
    expect(state.availability.length).toBe(6);
    expect(state.availability[0]?.start_time).toBe("07:00:00");
    expect(provisionCleanerIdentityMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        authEmail: "0792022648@shalean.co.za",
        fullName: "Ada Cleaner",
        phoneE164: "+27792022648",
        password: "secure-pass-1",
      }),
    );

    const audit = state.audits[0] as { metadata?: Record<string, unknown> };
    expect(audit.metadata?.authEmail).toBe("0792022648@shalean.co.za");
    expect(audit.metadata).not.toHaveProperty("password");
    expect(JSON.stringify(state.audits)).not.toContain("secure-pass");
  });

  it("never stores password in profile_created audit metadata", async () => {
    const state = {
      capabilities: [] as { cleaner_id: string; service_slug: string }[],
      areas: [] as { cleaner_id: string; area_slug: string }[],
      availability: [],
      audits: [] as Record<string, unknown>[],
    };
    const client = createMockClient(state);

    const { createCleaner } = await import("./createCleaner");
    await createCleaner(
      baseCreateParams({
        password: "super-secret-pass",
        confirmPassword: "super-secret-pass",
      }),
      client,
    );

    for (const row of state.audits) {
      const serialized = JSON.stringify(row);
      expect(serialized).not.toContain("super-secret-pass");
    }
  });

  it("returns PHONE_ALREADY_REGISTERED from identity provisioning", async () => {
    provisionCleanerIdentityMock.mockResolvedValue({
      ok: false,
      code: "PHONE_ALREADY_REGISTERED",
      message: "A cleaner with this phone number already exists.",
    });

    const { createCleaner } = await import("./createCleaner");
    const result = await createCleaner(baseCreateParams(), createMockClient({
      capabilities: [],
      areas: [],
      availability: [],
      audits: [],
    }));

    expect(result).toEqual({
      ok: false,
      code: "PHONE_ALREADY_REGISTERED",
      message: "A cleaner with this phone number already exists.",
    });
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

  it("rolls back cleaner row and auth user when child provisioning fails", async () => {
    const state = {
      capabilities: [] as { cleaner_id: string; service_slug: string }[],
      areas: [] as { cleaner_id: string; area_slug: string }[],
      availability: [],
      audits: [] as Record<string, unknown>[],
    };
    const client = createMockClient(state, { failCapabilitiesInsert: true });

    const { createCleaner } = await import("./createCleaner");
    const result = await createCleaner(baseCreateParams(), client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PROVISION_FAILED");
    expect(client.auth.admin.deleteUser).toHaveBeenCalledWith("profile-new");
  });

  it("returns 409 when identity provisioning reports duplicate email", async () => {
    provisionCleanerIdentityMock.mockResolvedValue({
      ok: false,
      code: "EMAIL_ALREADY_REGISTERED",
      message: "A cleaner account with this phone number already exists.",
    });

    const { createCleaner } = await import("./createCleaner");
    const result = await createCleaner(
      baseCreateParams(),
      createMockClient({
        capabilities: [],
        areas: [],
        availability: [],
        audits: [],
      }),
    );

    expect(result).toEqual({
      ok: false,
      code: "EMAIL_ALREADY_REGISTERED",
      message: "A cleaner account with this phone number already exists.",
    });
  });

  it("returns validation error for mismatched passwords", async () => {
    const { createCleaner } = await import("./createCleaner");
    const result = await createCleaner(
      {
        ...baseCreateParams(),
        confirmPassword: "other-pass-1",
      },
      createMockClient({
        capabilities: [],
        areas: [],
        availability: [],
        audits: [],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_PAYLOAD");
    expect(provisionCleanerIdentityMock).not.toHaveBeenCalled();
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
