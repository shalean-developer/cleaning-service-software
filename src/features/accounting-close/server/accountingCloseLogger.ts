import "server-only";

import { sanitizeLogDetails } from "@/lib/zoho/zohoInvoicePaymentLogger";

export const ACCOUNTING_CLOSE_LOG_NAMESPACE = "finance:accounting-close" as const;

export type AccountingCloseLogEvent =
  | "accounting_close_loaded"
  | "accounting_close_exported"
  | "accounting_close_failed";

const INFO_EVENTS = new Set<AccountingCloseLogEvent>([
  "accounting_close_loaded",
  "accounting_close_exported",
]);

export function logAccountingCloseEvent(
  event: AccountingCloseLogEvent,
  details: Record<string, unknown> = {},
): void {
  const payload = JSON.stringify({
    namespace: ACCOUNTING_CLOSE_LOG_NAMESPACE,
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
