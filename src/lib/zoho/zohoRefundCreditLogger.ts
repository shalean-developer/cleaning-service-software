import "server-only";

import { sanitizeLogDetails } from "./zohoInvoicePaymentLogger";

export const ZOHO_REFUND_CREDIT_LOG_NAMESPACE = "payments:zoho-refund-credit" as const;

export type ZohoRefundCreditLogEvent =
  | "zoho_refund_credit_sync_enqueued"
  | "zoho_refund_credit_sync_started"
  | "zoho_refund_credit_sync_succeeded"
  | "zoho_refund_credit_sync_failed"
  | "zoho_refund_credit_sync_retry_scheduled"
  | "zoho_refund_credit_sync_retry_exhausted"
  | "zoho_credit_note_created"
  | "zoho_credit_note_apply_failed";

const INFO_EVENTS = new Set<ZohoRefundCreditLogEvent>([
  "zoho_refund_credit_sync_enqueued",
  "zoho_refund_credit_sync_started",
  "zoho_refund_credit_sync_succeeded",
  "zoho_refund_credit_sync_retry_scheduled",
  "zoho_credit_note_created",
]);

export function logZohoRefundCreditEvent(
  event: ZohoRefundCreditLogEvent,
  details: Record<string, unknown> = {},
): void {
  const payload = JSON.stringify({
    namespace: ZOHO_REFUND_CREDIT_LOG_NAMESPACE,
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
