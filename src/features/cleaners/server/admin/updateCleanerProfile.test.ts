import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

type UpdateProfileMockOptions = {
  /** Simulates DB insert failure after delete (replace-all sync risk). */
  failCapabilityInsert?: boolean;
};

function createMockClient(
  state: {
    cleaner: { id: string; profile_id: string } | null;
    profile: { id: string; full_name: string | null };
    capabilities: { cleaner_id: string; service_slug: string }[];
    areas: { cleaner_id: string; area_slug: string }[];
    audits: Record<string, unknown>[];
  },
  options: UpdateProfileMockOptions = {},
): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      const api = {
        select: () => api,
        eq: () => api,
        maybeSingle: async () => {
          if (table === "cleaners") {
            return { data: state.cleaner, error: null };
          }
          if (table === "profiles") {
            return { data: state.profile, error: null };
          }
          return { data: null, error: null };
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async () => {
            if (table === "profiles") {
              Object.assign(state.profile, patch);
            }
            return { error: null };
          },
        }),
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
        insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(rows) ? rows : [rows];
          if (table === "cleaner_service_capabilities") {
            if (options.failCapabilityInsert) {
              state.capabilities = [];
              throw new Error("Capability insert failed after delete");
            }
            state.capabilities = list.map((row) => ({
              cleaner_id: row.cleaner_id as string,
              service_slug: row.service_slug as string,
            }));
          }
          if (table === "cleaner_service_areas") {
            state.areas = list.map((row) => ({
              cleaner_id: row.cleaner_id as string,
              area_slug: row.area_slug as string,
            }));
          }
          if (table === "cleaner_operational_audit") {
            state.audits.push(list[0] ?? {});
            return {
              select: () => ({
                single: async () => ({ data: { id: "audit-update-1" }, error: null }),
              }),
            };
          }
          return api;
        },
      };

      if (table === "cleaner_service_capabilities" || table === "cleaner_service_areas") {
        return {
          ...api,
          select: () => ({
            eq: async () => ({
              data:
                table === "cleaner_service_capabilities"
                  ? state.capabilities
                  : state.areas,
              error: null,
            }),
          }),
        };
      }

      return api;
    },
  } as unknown as SupabaseClient<Database>;
}

describe("updateCleanerProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates full name, capabilities, areas, and writes profile_updated audit", async () => {
    const state = {
      cleaner: { id: "cleaner-1", profile_id: "profile-1" },
      profile: { id: "profile-1", full_name: "Old Name" },
      capabilities: [{ cleaner_id: "cleaner-1", service_slug: "regular-cleaning" }],
      areas: [{ cleaner_id: "cleaner-1", area_slug: "sea-point" }],
      audits: [] as Record<string, unknown>[],
    };
    const client = createMockClient(state);

    const { updateCleanerProfile } = await import("./updateCleanerProfile");
    const result = await updateCleanerProfile(
      {
        cleanerId: "cleaner-1",
        adminProfileId: "admin-1",
        fullName: "New Name",
        serviceAreasInput: "Cape Town",
        capabilities: ["regular-cleaning", "deep-cleaning"],
      },
      client,
    );

    expect(result.ok).toBe(true);
    expect(state.profile.full_name).toBe("New Name");
    expect(state.capabilities.map((c) => c.service_slug).sort()).toEqual([
      "deep-cleaning",
      "regular-cleaning",
    ]);
    expect(state.areas.some((a) => a.area_slug === "cape-town")).toBe(true);

    const audit = state.audits[0] as {
      action?: string;
      metadata?: Record<string, unknown>;
    };
    expect(audit.action).toBe("profile_updated");
    expect(audit.metadata?.before).toEqual({
      fullName: "Old Name",
      capabilitySlugs: ["regular-cleaning"],
      serviceAreaSlugs: ["sea-point"],
    });
    expect(audit.metadata).not.toHaveProperty("password");
    expect(audit.metadata).not.toHaveProperty("phone");
  });

  it("rejects lifecycle fields in payload", async () => {
    const { parseUpdateCleanerProfileBody } = await import("./parseUpdateCleanerProfileBody");
    const parsed = parseUpdateCleanerProfileBody({
      fullName: "Ada",
      serviceAreasInput: "",
      capabilities: ["regular-cleaning"],
      active: false,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toMatch(/lifecycle/i);
  });

  it("rejects phone change in payload", async () => {
    const { parseUpdateCleanerProfileBody } = await import("./parseUpdateCleanerProfileBody");
    const parsed = parseUpdateCleanerProfileBody({
      fullName: "Ada",
      phone: "0799999999",
      serviceAreasInput: "",
      capabilities: ["regular-cleaning"],
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toMatch(/phone|email|password/i);
  });

  it("returns CLEANER_NOT_FOUND when cleaner missing", async () => {
    const { updateCleanerProfile } = await import("./updateCleanerProfile");
    const result = await updateCleanerProfile(
      {
        cleanerId: "missing",
        adminProfileId: "admin-1",
        fullName: "Ada",
        serviceAreasInput: "",
        capabilities: ["regular-cleaning"],
      },
      createMockClient({
        cleaner: null,
        profile: { id: "profile-1", full_name: "Ada" },
        capabilities: [],
        areas: [],
        audits: [],
      }),
    );

    expect(result).toEqual({
      ok: false,
      code: "CLEANER_NOT_FOUND",
      message: "Cleaner not found.",
    });
  });

  /**
   * Known product risk (v1): replace-all sync without a transaction.
   * TODO(phase-4-hardening): wrap profile + capability/area replace in a Postgres RPC
   * so insert failure after delete cannot leave zero capabilities.
   */
  it("documents partial state when capability insert fails after delete", async () => {
    const state = {
      cleaner: { id: "cleaner-1", profile_id: "profile-1" },
      profile: { id: "profile-1", full_name: "Old Name" },
      capabilities: [{ cleaner_id: "cleaner-1", service_slug: "regular-cleaning" }],
      areas: [] as { cleaner_id: string; area_slug: string }[],
      audits: [] as Record<string, unknown>[],
    };
    const client = createMockClient(state, { failCapabilityInsert: true });

    const { updateCleanerProfile } = await import("./updateCleanerProfile");
    const result = await updateCleanerProfile(
      {
        cleanerId: "cleaner-1",
        adminProfileId: "admin-1",
        fullName: "New Name",
        serviceAreasInput: "",
        capabilities: ["regular-cleaning", "deep-cleaning"],
      },
      client,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PERSISTENCE_ERROR");
    expect(state.profile.full_name).toBe("New Name");
    expect(state.capabilities).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });
});
