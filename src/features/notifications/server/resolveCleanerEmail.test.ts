import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { resolveCleanerEmail } from "./resolveCleanerEmail";

describe("resolveCleanerEmail", () => {
  it("resolves cleaner id to auth email and display name", async () => {
    const client = {
      from: (table: string) => {
        if (table === "cleaners") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "cleaner-1", profile_id: "profile-c1" },
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
                maybeSingle: async () => ({
                  data: { full_name: "Jordan" },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { email: "jordan@example.com" } },
            error: null,
          }),
        },
      },
    } as unknown as SupabaseClient<Database>;

    const result = await resolveCleanerEmail(client, "cleaner-1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.recipient.email).toBe("jordan@example.com");
    expect(result.recipient.displayName).toBe("Jordan");
  });

  it("fails safely when cleaner has no email", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "cleaner-1", profile_id: "profile-c1" },
              error: null,
            }),
          }),
        }),
      }),
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { email: "" } },
            error: null,
          }),
        },
      },
    } as unknown as SupabaseClient<Database>;

    const result = await resolveCleanerEmail(client, "cleaner-1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("NO_EMAIL");
  });

  it("fails when cleaner not found", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      auth: { admin: { getUserById: async () => ({ data: null, error: null }) } },
    } as unknown as SupabaseClient<Database>;

    const result = await resolveCleanerEmail(client, "missing");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("CLEANER_NOT_FOUND");
  });
});
