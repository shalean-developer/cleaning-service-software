import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CurrentUser } from "./types";

/**
 * Resolves the signed-in user and their authoritative `profiles.role` row.
 * Returns null when Supabase is not configured or there is no session.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  return getCurrentUserWithClient(supabase);
}

export async function getCurrentUserWithClient(
  supabase: SupabaseClient<Database>,
): Promise<CurrentUser | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  return {
    authUser: userData.user,
    profileId: profile.id,
    role: profile.role,
  };
}
