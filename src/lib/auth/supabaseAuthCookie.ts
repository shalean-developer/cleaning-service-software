/** Matches Supabase SSR auth cookie names, including chunked variants (`.0`, `.1`, …). */
export const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-[\w-]+-auth-token(?:\.\d+)?$/;

export function isSupabaseAuthCookieName(name: string): boolean {
  return SUPABASE_AUTH_COOKIE_PATTERN.test(name);
}
