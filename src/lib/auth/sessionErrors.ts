import type { AuthError } from "@supabase/supabase-js";

/**
 * True when cookies reference a refresh token Supabase no longer has
 * (revoked session, project reset, or env pointed at a different project).
 */
export function isStaleRefreshTokenError(error: AuthError | null | undefined): boolean {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return (
    error.code === "refresh_token_not_found" ||
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token")
  );
}
