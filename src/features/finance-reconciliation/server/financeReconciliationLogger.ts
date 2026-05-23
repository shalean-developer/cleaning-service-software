import "server-only";

import { sanitizeLogDetails } from "@/lib/zoho/zohoInvoicePaymentLogger";

export const FINANCE_RECONCILIATION_LOG_NAMESPACE = "finance:reconciliation" as const;

export type FinanceReconciliationLogEvent =
  | "finance_reconciliation_loaded"
  | "finance_reconciliation_exported"
  | "finance_reconciliation_failed";

const INFO_EVENTS = new Set<FinanceReconciliationLogEvent>([
  "finance_reconciliation_loaded",
  "finance_reconciliation_exported",
]);

export function logFinanceReconciliationEvent(
  event: FinanceReconciliationLogEvent,
  details: Record<string, unknown> = {},
): void {
  const payload = JSON.stringify({
    namespace: FINANCE_RECONCILIATION_LOG_NAMESPACE,
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
