import { normalizeZaMobilePhone } from "@/lib/validation/zaPhone";

/** E.164 phone for storage and duplicate checks. */
export function normalizeApplicationPhone(phone: string): string | null {
  return normalizeZaMobilePhone(phone);
}

/** Digits-only key for soft duplicate matching (+27...). */
export function phoneNormalizedKey(e164: string): string {
  return e164.replace(/\D/g, "");
}

export function normalizeApplicationEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export function normalizePreferredAreaSlug(area: string): string {
  return area
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
