/** South African mobile numbers normalized to E.164 (+27XXXXXXXXX). */

const MOBILE_NATIONAL = /^[6-8]\d{8}$/;
const MOBILE_LOCAL = /^0[6-8]\d{8}$/;
const MOBILE_COUNTRY = /^27[6-8]\d{8}$/;
const MOBILE_E164 = /^\+27[6-8]\d{8}$/;

function stripSeparators(value: string): string {
  return value.replace(/[\s\-().]/g, "");
}

/**
 * Normalizes a SA mobile number to E.164 (+27 + 9 digits).
 * Returns null when the value is empty or not a valid mobile.
 */
export function normalizeZaMobilePhone(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const compact = stripSeparators(trimmed);
  if (!compact) return null;

  if (MOBILE_E164.test(compact)) return compact;
  if (MOBILE_COUNTRY.test(compact)) return `+${compact}`;
  if (MOBILE_LOCAL.test(compact)) return `+27${compact.slice(1)}`;
  if (MOBILE_NATIONAL.test(compact)) return `+27${compact}`;

  return null;
}

export function isValidZaMobilePhone(value: string | null | undefined): boolean {
  return normalizeZaMobilePhone(value) != null;
}

/** Human-readable display for UI (e.g. 082 123 4567). */
export function formatZaMobileForDisplay(e164: string | null | undefined): string | null {
  const normalized = normalizeZaMobilePhone(e164);
  if (!normalized) return null;

  const national = `0${normalized.slice(3)}`;
  return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

/** Masked display for limited exposure (+27 ** *** 4567). */
export function maskZaMobilePhone(e164: string | null | undefined): string | null {
  const normalized = normalizeZaMobilePhone(e164);
  if (!normalized) return null;

  const last4 = normalized.slice(-4);
  return `+27 ** *** ${last4}`;
}
