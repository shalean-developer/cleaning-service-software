export const ZOHO_INVOICE_SAVE_PAYMENT_METHOD_CONSENT_VERSION = "2026-05-22";

export const ZOHO_INVOICE_SAVE_PAYMENT_METHOD_CONSENT_TEXT =
  "I authorise Shalean Cleaning Services to securely save my payment method and charge it for future approved invoices or recurring cleaning services.";

export type ZohoInvoiceSavePaymentMethodConsentMetadata = {
  save_payment_method_requested: true;
  consent_text_version: string;
  consent_text: string;
  consent_requested_at: string;
};

export function buildSavePaymentMethodConsentMetadata(): ZohoInvoiceSavePaymentMethodConsentMetadata {
  return {
    save_payment_method_requested: true,
    consent_text_version: ZOHO_INVOICE_SAVE_PAYMENT_METHOD_CONSENT_VERSION,
    consent_text: ZOHO_INVOICE_SAVE_PAYMENT_METHOD_CONSENT_TEXT,
    consent_requested_at: new Date().toISOString(),
  };
}

export function readSavePaymentMethodRequestedFromMetadata(
  metadata: unknown,
): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as Record<string, unknown>).save_payment_method_requested === true;
}

export type AuthorizationCaptureOutcome =
  | "not_requested"
  | "saved"
  | "not_reusable"
  | "missing_authorization_code"
  | "failed";

export function readAuthorizationCaptureOutcomeFromMetadata(
  metadata: unknown,
): AuthorizationCaptureOutcome | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>).authorization_capture_outcome;
  if (
    value === "not_requested" ||
    value === "saved" ||
    value === "not_reusable" ||
    value === "missing_authorization_code" ||
    value === "failed"
  ) {
    return value;
  }
  return null;
}
