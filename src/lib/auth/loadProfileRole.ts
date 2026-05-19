import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/lib/database/types";
import { missingProfileMessage } from "@/lib/auth/profileErrors";

export type ProfileRoleLookupResult =
  | { ok: true; role: UserRole }
  | { ok: false; error: string };

/**
 * Loads the signed-in user's profile role. Must filter by `userId` so admin RLS
 * (broad read) does not return multiple rows to maybeSingle().
 */
export async function loadProfileRoleForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProfileRoleLookupResult> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!profile?.role) {
    return { ok: false, error: missingProfileMessage() };
  }
  return { ok: true, role: profile.role as UserRole };
}
