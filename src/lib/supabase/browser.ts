import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { getSupabasePublicEnv } from "./publicEnv";

export class SupabaseBrowserConfigError extends Error {
  readonly code = "SUPABASE_BROWSER_CONFIG_MISSING" as const;

  constructor() {
    super(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local and restart the dev server.",
    );
    this.name = "SupabaseBrowserConfigError";
  }
}

/**
 * Browser Supabase client (anon key only). Returns null when public env is not configured.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> | null {
  const env = getSupabasePublicEnv();
  if (!env) return null;

  return createBrowserClient<Database>(env.url, env.anonKey, {
    auth: {
      // Dashboard session refresh is handled server-side (proxy/RSC).
      autoRefreshToken: false,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
}

/**
 * Same as {@link createSupabaseBrowserClient} but throws when public env is missing.
 */
export function requireSupabaseBrowserClient(): SupabaseClient<Database> {
  const client = createSupabaseBrowserClient();
  if (!client) {
    throw new SupabaseBrowserConfigError();
  }
  return client;
}
