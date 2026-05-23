import "server-only";

import { sanitizeLogDetails } from "@/lib/zoho/zohoInvoicePaymentLogger";

export const FINANCE_ANALYTICS_LOG_NAMESPACE = "finance:analytics" as const;

export type FinanceAnalyticsLogEvent =
  | "finance_analytics_loaded"
  | "finance_analytics_exported"
  | "finance_analytics_failed";

const INFO_EVENTS = new Set<FinanceAnalyticsLogEvent>([
  "finance_analytics_loaded",
  "finance_analytics_exported",
]);

export function logFinanceAnalyticsEvent(
  event: FinanceAnalyticsLogEvent,
  details: Record<string, unknown> = {},
): void {
  const payload = JSON.stringify({
    namespace: FINANCE_ANALYTICS_LOG_NAMESPACE,
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
