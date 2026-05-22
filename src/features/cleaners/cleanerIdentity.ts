import {
  buildShaleanCleanerAuthEmail,
  isShaleanCleanerAuthEmail,
  SHALEAN_CLEANER_EMAIL_DOMAIN,
  zaMobileToLocalLoginDigits,
} from "@/lib/auth/cleanerAuthIdentity";

export { SHALEAN_CLEANER_EMAIL_DOMAIN };

/**
 * Local login identity digits used for Shalean cleaner auth emails (0XXXXXXXXX).
 * Delegates to the same normalization as admin provisioning and sign-in.
 */
export function normalizeCleanerPhoneIdentity(phoneInput: string): string | null {
  return zaMobileToLocalLoginDigits(phoneInput);
}

/**
 * Deterministic cleaner sign-in email: {localMobileDigits}@shalean.co.za
 * Example: +27 81 076 8318 → 0810768318@shalean.co.za
 */
export function buildCleanerIdentityEmail(phoneInput: string): string | null {
  const email = buildShaleanCleanerAuthEmail(phoneInput);
  if (!email || !email.endsWith(`@${SHALEAN_CLEANER_EMAIL_DOMAIN}`)) {
    return null;
  }
  return email;
}

export function isValidCleanerIdentityEmail(email: string): boolean {
  return isShaleanCleanerAuthEmail(email);
}
