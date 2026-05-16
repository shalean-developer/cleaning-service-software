import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

function getServiceRoleEnv(): { url: string; serviceRoleKey: string } | null {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

/**
 * Server-only Supabase client with service role (bypasses RLS).
 * Used for booking command persistence — never import from client bundles.
 */
export function createServiceRoleClient(): SupabaseClient<Database> | null {
  const env = getServiceRoleEnv();
  if (!env) return null;

  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function requireServiceRoleClient(): SupabaseClient<Database> {
  const client = createServiceRoleClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) are required for booking command persistence.",
    );
  }
  return client;
}
