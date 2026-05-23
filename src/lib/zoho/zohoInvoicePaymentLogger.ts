import "server-only";

export const ZOHO_INVOICE_PAYMENT_LOG_NAMESPACE = "payments:zoho-invoice" as const;

export type ZohoInvoicePaymentLogEvent =
  | "invoice_number_invalid"
  | "zoho_not_configured"
  | "zoho_invoice_fetch_started"
  | "zoho_invoice_fetch_succeeded"
  | "zoho_invoice_fetch_failed"
  | "zoho_invoice_not_found"
  | "zoho_invoice_status_mapped"
  | "zoho_token_refresh_failed"
  | "zoho_api_latency_warning"
  | "zoho_invoice_initialize_started"
  | "zoho_invoice_initialize_reused_pending"
  | "zoho_invoice_initialize_blocked_not_payable"
  | "zoho_invoice_payment_attempt_created"
  | "zoho_invoice_paystack_initialize_started"
  | "zoho_invoice_paystack_initialize_succeeded"
  | "zoho_invoice_paystack_initialize_failed"
  | "zoho_invoice_webhook_routed"
  | "zoho_invoice_webhook_duplicate"
  | "zoho_invoice_paystack_verify_started"
  | "zoho_invoice_paystack_verify_succeeded"
  | "zoho_invoice_paystack_verify_failed"
  | "zoho_invoice_amount_mismatch"
  | "zoho_invoice_currency_mismatch"
  | "zoho_invoice_zoho_reconcile_started"
  | "zoho_invoice_zoho_reconcile_succeeded"
  | "zoho_invoice_zoho_reconcile_failed"
  | "zoho_invoice_marked_paid"
  | "zoho_invoice_marked_failed"
  | "zoho_invoice_reconcile_cron_started"
  | "zoho_invoice_reconcile_cron_completed"
  | "zoho_invoice_reconcile_retry_started"
  | "zoho_invoice_reconcile_retry_succeeded"
  | "zoho_invoice_reconcile_retry_failed"
  | "zoho_invoice_reconcile_retry_scheduled"
  | "zoho_invoice_reconcile_retry_exhausted"
  | "zoho_invoice_diagnostics_loaded"
  | "zoho_invoice_admin_link_generated"
  | "zoho_invoice_admin_link_invalid"
  | "zoho_invoice_admin_invoice_checked"
  | "zoho_invoice_admin_invoice_check_failed"
  | "zoho_invoice_save_method_consent_requested"
  | "zoho_invoice_authorization_capture_started"
  | "zoho_invoice_authorization_capture_succeeded"
  | "zoho_invoice_authorization_capture_skipped_not_requested"
  | "zoho_invoice_authorization_capture_skipped_not_reusable"
  | "zoho_invoice_authorization_capture_failed"
  | "zoho_invoice_payment_method_saved"
  | "zoho_invoice_payment_method_duplicate"
  | "zoho_invoice_admin_charge_started"
  | "zoho_invoice_admin_charge_blocked"
  | "zoho_invoice_admin_charge_submitted"
  | "zoho_invoice_admin_charge_failed"
  | "zoho_invoice_authorization_charge_webhook_routed"
  | "zoho_invoice_authorization_charge_verify_started"
  | "zoho_invoice_authorization_charge_verify_succeeded"
  | "zoho_invoice_authorization_charge_verify_failed"
  | "zoho_invoice_authorization_charge_reconciled"
  | "zoho_invoice_authorization_charge_reconcile_failed"
  | "zoho_invoice_payment_methods_listed"
  | "zoho_invoice_payment_method_revoke_started"
  | "zoho_invoice_payment_method_revoked"
  | "zoho_invoice_payment_method_revoke_failed"
  | "zoho_invoice_payment_method_audit_recorded"
  | "zoho_invoice_payment_method_last_used_updated"
  | "zoho_invoice_payments_feature_disabled"
  | "zoho_saved_methods_feature_disabled"
  | "zoho_invoice_fetch_debug"
  | "zoho_oauth_refresh_debug";

const SENSITIVE_LOG_KEY_PATTERN =
  /(?:^access[_-]?token$|^refresh[_-]?token$|client[_-]?secret|authorization_code|authorizationCode|password|api[_-]?key|authorization_url|authorizationUrl)/i;

const SAFE_DIAGNOSTIC_KEYS = new Set([
  "refreshTokenLength",
  "refreshTokenLikelyTruncated",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return "[redacted-email]";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

function sanitizeLogValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (EMAIL_PATTERN.test(value.trim())) {
      return maskEmail(value.trim());
    }
    if (value.length > 500) {
      return `${value.slice(0, 500)}…[truncated]`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeLogValue);
  }

  if (value != null && typeof value === "object") {
    return sanitizeLogDetails(value as Record<string, unknown>);
  }

  return value;
}

export function sanitizeLogDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (!SAFE_DIAGNOSTIC_KEYS.has(key) && SENSITIVE_LOG_KEY_PATTERN.test(key)) {
      sanitized[key] = "[redacted]";
      continue;
    }

    if (key === "email" || key === "customerEmail" || key === "customer_email") {
      sanitized[key] =
        typeof value === "string" && value.trim() ? maskEmail(value.trim()) : value;
      continue;
    }

    if (
      key === "authorization_signature" ||
      key === "authorizationSignature" ||
      key === "paystack_customer_code" ||
      key === "paystackCustomerCode"
    ) {
      sanitized[key] = "[redacted]";
      continue;
    }

    if (key === "rawPayload" || key === "rawZohoPayload" || key === "zohoPayload" || key === "rawPaystackAuthorization") {
      sanitized[key] = "[redacted]";
      continue;
    }

    sanitized[key] = sanitizeLogValue(value);
  }

  return sanitized;
}

const INFO_EVENTS = new Set<ZohoInvoicePaymentLogEvent>([
  "zoho_invoice_fetch_started",
  "zoho_invoice_fetch_succeeded",
  "zoho_invoice_status_mapped",
  "zoho_invoice_initialize_started",
  "zoho_invoice_initialize_reused_pending",
  "zoho_invoice_payment_attempt_created",
  "zoho_invoice_paystack_initialize_started",
  "zoho_invoice_paystack_initialize_succeeded",
  "zoho_invoice_webhook_routed",
  "zoho_invoice_paystack_verify_started",
  "zoho_invoice_paystack_verify_succeeded",
  "zoho_invoice_zoho_reconcile_started",
  "zoho_invoice_zoho_reconcile_succeeded",
  "zoho_invoice_marked_paid",
  "zoho_invoice_reconcile_cron_started",
  "zoho_invoice_reconcile_cron_completed",
  "zoho_invoice_reconcile_retry_started",
  "zoho_invoice_reconcile_retry_succeeded",
  "zoho_invoice_reconcile_retry_scheduled",
  "zoho_invoice_diagnostics_loaded",
  "zoho_invoice_admin_link_generated",
  "zoho_invoice_admin_invoice_checked",
  "zoho_invoice_save_method_consent_requested",
  "zoho_invoice_authorization_capture_started",
  "zoho_invoice_authorization_capture_succeeded",
  "zoho_invoice_authorization_capture_skipped_not_requested",
  "zoho_invoice_authorization_capture_skipped_not_reusable",
  "zoho_invoice_payment_method_saved",
  "zoho_invoice_admin_charge_started",
  "zoho_invoice_admin_charge_submitted",
  "zoho_invoice_authorization_charge_webhook_routed",
  "zoho_invoice_authorization_charge_verify_started",
  "zoho_invoice_authorization_charge_verify_succeeded",
  "zoho_invoice_authorization_charge_reconciled",
  "zoho_invoice_payment_methods_listed",
  "zoho_invoice_payment_method_revoked",
  "zoho_invoice_payment_method_audit_recorded",
  "zoho_invoice_payment_method_last_used_updated",
]);

export function logZohoInvoicePaymentEvent(
  event: ZohoInvoicePaymentLogEvent,
  details: Record<string, unknown> = {},
): void {
  const payload = JSON.stringify({
    namespace: ZOHO_INVOICE_PAYMENT_LOG_NAMESPACE,
    event,
    at: new Date().toISOString(),
    ...sanitizeLogDetails(details),
  });

  if (INFO_EVENTS.has(event)) {
    console.info(payload);
    return;
  }

  console.warn(payload);
}

export type ZohoInvoiceFetchFailureDevDetails = {
  httpStatus?: number | null;
  zohoResponseCode?: number | null;
  zohoResponseMessage?: string | null;
  endpointPath: string;
  queryParams: Record<string, string>;
  invoiceNumber?: string | null;
  lookupMethod?: string | null;
  reason?: string | null;
};

export type ZohoOAuthFailureDevDetails = {
  httpStatus?: number | null;
  zohoResponseCode?: number | null;
  zohoResponseMessage?: string | null;
  endpointPath: string;
  queryParams: Record<string, string>;
  refreshTokenLength?: number | null;
  refreshTokenLikelyTruncated?: boolean | null;
};

function isNonProductionNodeEnv(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function logZohoInvoiceFetchFailureDev(
  details: ZohoInvoiceFetchFailureDevDetails,
): void {
  if (!isNonProductionNodeEnv()) return;

  const payload = JSON.stringify({
    namespace: ZOHO_INVOICE_PAYMENT_LOG_NAMESPACE,
    event: "zoho_invoice_fetch_debug" satisfies ZohoInvoicePaymentLogEvent,
    at: new Date().toISOString(),
    ...sanitizeLogDetails(details as Record<string, unknown>),
  });

  console.warn(payload);
}

export function logZohoOAuthFailureDev(details: ZohoOAuthFailureDevDetails): void {
  if (!isNonProductionNodeEnv()) return;

  const payload = JSON.stringify({
    namespace: ZOHO_INVOICE_PAYMENT_LOG_NAMESPACE,
    event: "zoho_oauth_refresh_debug" satisfies ZohoInvoicePaymentLogEvent,
    at: new Date().toISOString(),
    ...sanitizeLogDetails(details as Record<string, unknown>),
  });

  console.warn(payload);
}
