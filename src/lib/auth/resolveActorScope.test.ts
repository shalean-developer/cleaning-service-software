import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { resolveActorScope } from "./resolveActorScope";

const CLEANER_PROFILE_ID = "06307bd9-e70f-49e7-8a6a-f0c13636b9e9";
const CLEANER_ROW_ID = "bbfc422b-0d6b-4630-8540-bcc8d4147ade";

function createScopeMock(options: {
  customerRow?: { id: string } | null;
  cleanerRow?: { id: string } | null;
}) {
  const from = vi.fn((table: string) => {
    if (table === "customers") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({ data: options.customerRow ?? null, error: null }),
            ),
          })),
        })),
      };
    }
    if (table === "cleaners") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({ data: options.cleanerRow ?? null, error: null }),
            ),
          })),
        })),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return { from } as unknown as SupabaseClient<Database>;
}

describe("resolveActorScope", () => {
  it("resolves cleaners.id for cleaner profile with cleaner record", async () => {
    const client = createScopeMock({
      cleanerRow: { id: CLEANER_ROW_ID },
    });

    const scope = await resolveActorScope(client, CLEANER_PROFILE_ID, "cleaner");

    expect(scope.actingCleanerId).toBe(CLEANER_ROW_ID);
    expect(scope.actingCustomerId).toBeUndefined();
  });

  it("returns null actingCustomerId when customer has no customers row", async () => {
    const client = createScopeMock({ customerRow: null });

    const scope = await resolveActorScope(client, "customer-profile", "customer");

    expect(scope.actingCustomerId).toBeNull();
    expect(scope.actingCleanerId).toBeUndefined();
  });
});
