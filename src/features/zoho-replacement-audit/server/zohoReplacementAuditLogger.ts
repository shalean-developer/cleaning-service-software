import "server-only";

import { sanitizeLogDetails } from "@/lib/zoho/zohoInvoicePaymentLogger";

export const ZOHO_REPLACEMENT_AUDIT_LOG_NAMESPACE = "finance:zoho-replacement-audit" as const;

export type ZohoReplacementAuditLogEvent =
  | "zoho_replacement_audit_loaded"
  | "zoho_replacement_audit_exported"
  | "zoho_replacement_audit_failed";

const INFO_EVENTS = new Set<ZohoReplacementAuditLogEvent>([
  "zoho_replacement_audit_loaded",
  "zoho_replacement_audit_exported",
]);

export function logZohoReplacementAuditEvent(
  event: ZohoReplacementAuditLogEvent,
  details: Record<string, unknown> = {},
): void {
  const payload = JSON.stringify({
    namespace: ZOHO_REPLACEMENT_AUDIT_LOG_NAMESPACE,
    event,
    at: new Date().toISOString(),
    ...sanitizeLogDetails(details),
  });

  if (INFO_EVENTS.has(event)) {
    console.info(payload);
  } else {
    console.warn(payload);
  }
}
