import "server-only";

const MAX_INVOICE_NUMBER_LENGTH = 32;

/** Allowed: ASCII letters, digits, hyphen, underscore only. */
const INVOICE_NUMBER_PATTERN = /^[A-Za-z0-9_-]+$/;

const PATH_TRAVERSAL_PATTERN = /(?:\.\.|%2e%2e|%2f|\\|\/)/i;

export type InvoiceNumberValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; code: "INVALID_INVOICE_NUMBER"; message: string };

/**
 * Validates and normalizes a Zoho invoice number from URL or API input.
 * Normalized form: trimmed, uppercase (e.g. inv-001602 → INV-001602).
 */
export function validateAndNormalizeInvoiceNumber(
  raw: string | null | undefined,
): InvoiceNumberValidationResult {
  if (raw == null) {
    return {
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
      message: "Invoice number is required.",
    };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
      message: "Invoice number is required.",
    };
  }

  if (trimmed.length > MAX_INVOICE_NUMBER_LENGTH) {
    return {
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
      message: "Invoice number is too long.",
    };
  }

  if (PATH_TRAVERSAL_PATTERN.test(trimmed)) {
    return {
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
      message: "Invoice number format is invalid.",
    };
  }

  if (/\s/.test(trimmed) || /[^\x00-\x7F]/.test(trimmed)) {
    return {
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
      message: "Invoice number format is invalid.",
    };
  }

  if (!INVOICE_NUMBER_PATTERN.test(trimmed)) {
    return {
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
      message: "Invoice number format is invalid.",
    };
  }

  return { ok: true, normalized: trimmed.toUpperCase() };
}
