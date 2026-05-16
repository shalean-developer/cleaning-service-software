import { resolvePostSignInPath } from "./redirects";

export const SIGN_UP_PATH = "/sign-up" as const;
export const SIGN_UP_CHECK_EMAIL_PATH = "/sign-up/check-email" as const;

/** Minimum length aligned with supabase/config.toml `minimum_password_length`. */
export const CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH = 6;

export type CustomerSignupUserMetadata = {
  full_name: string;
};

/**
 * Safe signup metadata for Supabase `options.data`.
 * Never includes role — provisioning relies on handle_new_user + customer triggers.
 */
export function buildCustomerSignupMetadata(fullName: string): CustomerSignupUserMetadata {
  return { full_name: fullName.trim() };
}

/** Where to send a new customer after sign-up when a session exists immediately. */
export function resolvePostCustomerSignUpPath(
  redirectedFrom: string | null | undefined,
): string {
  return resolvePostSignInPath("customer", redirectedFrom);
}

/** Auth callback URL for email confirmation links (browser origin). */
export function buildCustomerSignupEmailRedirectUrl(origin: string): string {
  return new URL("/auth/callback", origin).toString();
}
