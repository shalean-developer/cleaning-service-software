import "server-only";

import { cookies } from "next/headers";
import { isSupabaseAuthCookieName } from "@/lib/auth/supabaseAuthCookie";

/**
 * Removes Supabase auth cookies from the server cookie jar.
 * Use when refresh tokens are invalid so the next request does not retry refresh.
 */
export async function clearSupabaseAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) {
    if (isSupabaseAuthCookieName(name)) {
      cookieStore.delete(name);
    }
  }
}
