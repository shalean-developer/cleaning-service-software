import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/lib/database/types";

export type ProfileRoleLookupResult =
  | { ok: true; role: UserRole }
  | { ok: false; error: string };

const NO_PROFILE_MESSAGE =
  "Signed in but no profile was found. Contact support or re-run E2E seed.";

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
    return { ok: false, error: NO_PROFILE_MESSAGE };
  }
  return { ok: true, role: profile.role as UserRole };
}
