import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { defaultCleanerAvailabilityFormValues } from "@/features/cleaners/admin/cleanerAvailability";

type UpdateProfileMockOptions = {
  /** Simulates DB insert failure after delete (replace-all sync risk). */
  failCapabilityInsert?: boolean;
  failAvailabilityInsert?: boolean;
};

function createMockClient(
  state: {
    cleaner: { id: string; profile_id: string } | null;
    profile: { id: string; full_name: string | null };
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
          if (table === "cleaner_availability") {
            if (options.failAvailabilityInsert) {
              state.availability = [];
              throw new Error("Availability insert failed after delete");
            }
            state.availability = list.map((row) => ({
              cleaner_id: row.cleaner_id as string,
              day_of_week: row.day_of_week as number,
              start_time: row.start_time as string,
              end_time: row.end_time as string,
              timezone: row.timezone as string,
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

      if (
        table === "cleaner_service_capabilities" ||
        table === "cleaner_service_areas" ||
        table === "cleaner_availability"
      ) {
        return {
          ...api,
          select: () => ({
            eq: async () => ({
              data:
                table === "cleaner_service_capabilities"
                  ? state.capabilities
                  : table === "cleaner_service_areas"
                    ? state.areas
                    : state.availability,
              error: null,
            }),
          }),
        };
      }

      return api;
    },
  } as unknown as SupabaseClient<Database>;
}

const defaultAvailability = defaultCleanerAvailabilityFormValues();

describe("updateCleanerProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates full name, capabilities, areas, availability, and writes profile_updated audit", async () => {
    const state = {
      cleaner: { id: "cleaner-1", profile_id: "profile-1" },
      profile: { id: "profile-1", full_name: "Old Name" },
      capabilities: [{ cleaner_id: "cleaner-1", service_slug: "regular-cleaning" }],
      areas: [{ cleaner_id: "cleaner-1", area_slug: "sea-point" }],
      availability: [
        {
          cleaner_id: "cleaner-1",
          day_of_week: 1,
          start_time: "08:00:00",
          end_time: "17:00:00",
          timezone: "Africa/Johannesburg",
        },
      ],
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
        workingDays: defaultAvailability.workingDays,
        startTime: defaultAvailability.startTime,
        endTime: defaultAvailability.endTime,
        timezone: defaultAvailability.timezone,
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
    expect(state.availability.length).toBe(6);

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
      workingDays: [1],
      startTime: "07:00",
      endTime: "18:00",
      timezone: "Africa/Johannesburg",
      active: false,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toMatch(/lifecycle/i);
  });

  it("rejects invalid availability in payload", async () => {
    const { parseUpdateCleanerProfileBody } = await import("./parseUpdateCleanerProfileBody");
    const parsed = parseUpdateCleanerProfileBody({
      fullName: "Ada",
      serviceAreasInput: "",
      capabilities: ["regular-cleaning"],
      workingDays: [1],
      startTime: "18:00",
      endTime: "07:00",
      timezone: "Africa/Johannesburg",
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toMatch(/after start/i);
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
        ...defaultAvailability,
      },
      createMockClient({
        cleaner: null,
        profile: { id: "profile-1", full_name: "Ada" },
        capabilities: [],
        areas: [],
        availability: [],
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
   * TODO(phase-4-hardening): wrap profile + child row replace in a Postgres RPC
   * so insert failure after delete cannot leave zero availability rows.
   */
  it("documents partial state when availability insert fails after delete", async () => {
    const state = {
      cleaner: { id: "cleaner-1", profile_id: "profile-1" },
      profile: { id: "profile-1", full_name: "Old Name" },
      capabilities: [{ cleaner_id: "cleaner-1", service_slug: "regular-cleaning" }],
      areas: [] as { cleaner_id: string; area_slug: string }[],
      availability: [
        {
          cleaner_id: "cleaner-1",
          day_of_week: 1,
          start_time: "07:00:00",
          end_time: "18:00:00",
          timezone: "Africa/Johannesburg",
        },
      ],
      audits: [] as Record<string, unknown>[],
    };
    const client = createMockClient(state, { failAvailabilityInsert: true });

    const { updateCleanerProfile } = await import("./updateCleanerProfile");
    const result = await updateCleanerProfile(
      {
        cleanerId: "cleaner-1",
        adminProfileId: "admin-1",
        fullName: "New Name",
        serviceAreasInput: "",
        capabilities: ["regular-cleaning", "deep-cleaning"],
        ...defaultAvailability,
      },
      client,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PERSISTENCE_ERROR");
    expect(state.profile.full_name).toBe("New Name");
    expect(state.capabilities).toHaveLength(2);
    expect(state.availability).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });
});
