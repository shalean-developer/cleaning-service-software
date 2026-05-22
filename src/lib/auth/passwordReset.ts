/** Where Supabase sends users after they click the password reset email link. */
export const RESET_PASSWORD_PATH = "/reset-password" as const;

/** Generic copy. must not reveal whether the email is registered. */
export const PASSWORD_RESET_REQUEST_SUCCESS_MESSAGE =
  "If an account exists for this email, we'll send a reset link shortly." as const;

/** Builds the absolute redirect URL for `resetPasswordForEmail`. */
export function buildPasswordResetRedirectUrl(origin: string): string {
  return new URL(RESET_PASSWORD_PATH, origin).toString();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPasswordResetEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
