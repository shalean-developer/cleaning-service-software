import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database/types";
import { getSupabasePublicEnv } from "./publicEnv";

/**
 * Server-only Supabase client (user-scoped, respects the caller session cookie jar).
 * Use only in Server Components, Route Handlers, and Server Actions. never import from client bundles.
 */
export async function createSupabaseServerClient(): Promise<
  SupabaseClient<Database> | null
> {
  const env = getSupabasePublicEnv();
  if (!env) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component without mutable response context. ignore refresh writes.
        }
      },
    },
  });
}
