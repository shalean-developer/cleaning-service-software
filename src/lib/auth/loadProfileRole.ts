import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/lib/database/types";
import {
  missingProfileMessage,
  profileRoleLookupTimeoutMessage,
} from "@/lib/auth/profileErrors";

export type ProfileRoleLookupResult =
  | { ok: true; role: UserRole }
  | { ok: false; error: string };

/** Max wait for the scoped profiles.role read after sign-in. */
export const PROFILE_ROLE_LOOKUP_TIMEOUT_MS = 8_000;

/**
 * Loads the signed-in user's profile role. Must filter by `userId` so admin RLS
 * (broad read) does not return multiple rows to maybeSingle().
 */
export async function loadProfileRoleForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProfileRoleLookupResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const lookup = supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
    .then(({ data: profile, error }) => {
      if (error) {
        return { ok: false as const, error: error.message };
      }
      if (!profile?.role) {
        return { ok: false as const, error: missingProfileMessage() };
      }
      return { ok: true as const, role: profile.role as UserRole };
    });

  const timed = new Promise<ProfileRoleLookupResult>((resolve) => {
    timeoutId = setTimeout(
      () => resolve({ ok: false, error: profileRoleLookupTimeoutMessage() }),
      PROFILE_ROLE_LOOKUP_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([lookup, timed]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
