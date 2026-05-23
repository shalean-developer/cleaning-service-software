import "server-only";

import { sanitizeLogDetails } from "@/lib/zoho/zohoInvoicePaymentLogger";

export const TAX_REPORT_LOG_NAMESPACE = "finance:tax-reports" as const;

export type TaxReportLogEvent =
  | "tax_report_loaded"
  | "tax_report_exported"
  | "tax_report_failed";

const INFO_EVENTS = new Set<TaxReportLogEvent>(["tax_report_loaded", "tax_report_exported"]);

export function logTaxReportEvent(
  event: TaxReportLogEvent,
  details: Record<string, unknown> = {},
): void {
  const payload = JSON.stringify({
    namespace: TAX_REPORT_LOG_NAMESPACE,
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
