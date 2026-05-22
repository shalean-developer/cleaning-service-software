import { normalizeZaMobilePhone } from "./zaPhone";

/** Shown when signup or forms reject an invalid SA mobile input. */
export const SOUTH_AFRICAN_MOBILE_INVALID_MESSAGE =
  "Enter a valid South African mobile number." as const;

/**
 * Normalizes South African mobile input to E.164 (+27XXXXXXXXX).
 * Returns null when empty or invalid.
 */
export function normalizeSouthAfricanPhone(input: string): string | null {
  return normalizeZaMobilePhone(input);
}
