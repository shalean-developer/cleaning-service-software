/**
 * User-facing copy when auth.users exists but public.profiles does not.
 * Never expose internal IDs or imply a role was granted.
 */

const NO_PROFILE_PRODUCTION =
  "Your account is not fully set up yet. Please contact support.";

const NO_PROFILE_DEVELOPMENT =
  "Signed in but no profile was found. For local/E2E accounts run: npm run e2e:seed";

/** Resolves the message shown after sign-in when profiles.role cannot be loaded. */
export function missingProfileMessage(): string {
  if (process.env.NODE_ENV === "production") {
    return NO_PROFILE_PRODUCTION;
  }
  return NO_PROFILE_DEVELOPMENT;
}

const PROFILE_LOOKUP_TIMEOUT =
  "We could not verify your account access. Check your connection and try again.";

/** Shown when the post-sign-in profile role query exceeds the timeout. */
export function profileRoleLookupTimeoutMessage(): string {
  return PROFILE_LOOKUP_TIMEOUT;
}
