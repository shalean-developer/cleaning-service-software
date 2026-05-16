import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database/types";
import { loadProfileRoleForUser } from "./loadProfileRole";

const ADMIN_USER_ID = "168c96e1-3d07-447f-bf64-3c0bbb8f9a3b";

function createProfilesMock(
  resolve: (userId: string) => { data: { role: string } | null; error: null },
) {
  const maybeSingle = vi.fn((...args: unknown[]) => {
    const chain = args[0] as { _userId?: string } | undefined;
    const userId = chain?._userId ?? "";
    return Promise.resolve(resolve(userId));
  });
  const eq = vi.fn((column: string, userId: string) => {
    expect(column).toBe("id");
    const chain = { _userId: userId };
    return { maybeSingle: () => maybeSingle(chain) };
  });
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn((table: string) => {
    expect(table).toBe("profiles");
    return { select };
  });
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    eq,
    maybeSingle,
  };
}

describe("loadProfileRoleForUser", () => {
  it("queries profiles scoped to the authenticated user id", async () => {
    const { client, eq } = createProfilesMock((userId) => {
      expect(userId).toBe(ADMIN_USER_ID);
      return { data: { role: "admin" }, error: null };
    });

    const result = await loadProfileRoleForUser(client, ADMIN_USER_ID);

    expect(result).toEqual({ ok: true, role: "admin" });
    expect(eq).toHaveBeenCalledWith("id", ADMIN_USER_ID);
  });

  it("resolves only the signed-in admin role when many profiles are readable via RLS", async () => {
    const { client, eq } = createProfilesMock((userId) => {
      if (userId !== ADMIN_USER_ID) {
        return { data: null, error: null };
      }
      return { data: { role: "admin" }, error: null };
    });

    const result = await loadProfileRoleForUser(client, ADMIN_USER_ID);

    expect(result).toEqual({ ok: true, role: "admin" });
    expect(eq).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith("id", ADMIN_USER_ID);
  });

  it("returns customer role when scoped to a customer user id", async () => {
    const customerId = "16e09f09-a5ac-4c01-a429-c1752c951a49";
    const { client } = createProfilesMock((userId) => {
      if (userId === customerId) {
        return { data: { role: "customer" }, error: null };
      }
      return { data: null, error: null };
    });

    const result = await loadProfileRoleForUser(client, customerId);

    expect(result).toEqual({ ok: true, role: "customer" });
  });

  it("fails when no profile row exists for the user id", async () => {
    const { client } = createProfilesMock(() => ({ data: null, error: null }));

    const result = await loadProfileRoleForUser(client, ADMIN_USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("no profile was found");
    }
  });
});
