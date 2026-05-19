import { normalizeZaMobilePhone } from "@/lib/validation/zaPhone";

/** Internal auth email domain for admin-provisioned cleaners. */
export const SHALEAN_CLEANER_EMAIL_DOMAIN = "shalean.co.za";

export type ResolveSignInEmailResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

/**
 * Converts E.164 (+27XXXXXXXXX) to local login digits (0XXXXXXXXX).
 */
export function zaMobileToLocalLoginDigits(e164: string): string | null {
  const normalized = normalizeZaMobilePhone(e164);
  if (!normalized || !normalized.startsWith("+27")) return null;
  const national = normalized.slice(3);
  if (national.length !== 9) return null;
  return `0${national}`;
}

/**
 * Builds the Supabase auth email for a cleaner from any accepted SA mobile input.
 * Example: 0792022648 -> 0792022648@shalean.co.za
 */
export function buildShaleanCleanerAuthEmail(phoneInput: string): string | null {
  const localDigits = zaMobileToLocalLoginDigits(phoneInput);
  if (!localDigits) return null;
  return `${localDigits}@${SHALEAN_CLEANER_EMAIL_DOMAIN}`;
}

export function isShaleanCleanerAuthEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return lower.endsWith(`@${SHALEAN_CLEANER_EMAIL_DOMAIN}`);
}

/**
 * Resolves the sign-in identifier to a Supabase auth email.
 * - Values containing `@` are used as email (unchanged customer/admin flow).
 * - Other values are treated as SA mobile numbers and mapped to @shalean.co.za.
 */
export function resolveSignInEmail(identifier: string): ResolveSignInEmailResult {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return { ok: false, error: "Email or mobile number is required." };
  }

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    return { ok: true, email };
  }

  const shaleanEmail = buildShaleanCleanerAuthEmail(trimmed);
  if (!shaleanEmail) {
    return {
      ok: false,
      error: "Enter a valid email address or South African mobile number.",
    };
  }

  return { ok: true, email: shaleanEmail };
}
