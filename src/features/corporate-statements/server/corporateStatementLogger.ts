import "server-only";

import { sanitizeLogDetails } from "@/lib/zoho/zohoInvoicePaymentLogger";

export const CORPORATE_STATEMENT_LOG_NAMESPACE = "finance:corporate-statements" as const;

export type CorporateStatementLogEvent =
  | "corporate_statement_loaded"
  | "corporate_statement_exported"
  | "corporate_statement_failed";

const INFO_EVENTS = new Set<CorporateStatementLogEvent>([
  "corporate_statement_loaded",
  "corporate_statement_exported",
]);

export function logCorporateStatementEvent(
  event: CorporateStatementLogEvent,
  details: Record<string, unknown> = {},
): void {
  const payload = JSON.stringify({
    namespace: CORPORATE_STATEMENT_LOG_NAMESPACE,
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
