import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

export type ResolvedCleanerEmail = {
  email: string;
  displayName: string | null;
};

export type ResolveCleanerEmailResult =
  | { ok: true; recipient: ResolvedCleanerEmail }
  | { ok: false; code: "CLEANER_NOT_FOUND" | "NO_EMAIL" };

/**
 * Resolves cleaners.id → auth email via profile_id (no PII in logs).
 */
export async function resolveCleanerEmail(
  client: SupabaseClient<Database>,
  cleanerId: string,
): Promise<ResolveCleanerEmailResult> {
  const { data: cleaner, error: cleanerError } = await client
    .from("cleaners")
    .select("id, profile_id")
    .eq("id", cleanerId)
    .maybeSingle();

  if (cleanerError || !cleaner) {
    return { ok: false, code: "CLEANER_NOT_FOUND" };
  }

  const { data: profile } = await client
    .from("profiles")
    .select("full_name")
    .eq("id", cleaner.profile_id)
    .maybeSingle();

  const { data: authData, error: authError } = await client.auth.admin.getUserById(
    cleaner.profile_id,
  );

  const email = authData?.user?.email?.trim();
  if (authError || !email) {
    return { ok: false, code: "NO_EMAIL" };
  }

  const displayName = profile?.full_name?.trim() || null;

  return {
    ok: true,
    recipient: { email, displayName },
  };
}
