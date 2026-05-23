import "server-only";

import type { ZohoInvoicePaymentPublicStatus } from "./types";

export const ZOHO_INVOICE_PUBLIC_MESSAGES = {
  not_configured: "Online invoice payments are not available yet.",
  not_found: "We could not find this invoice.",
  error: "Invoice payment details are temporarily unavailable.",
} as const satisfies Record<
  Extract<ZohoInvoicePaymentPublicStatus, "not_configured" | "not_found" | "error">,
  string
>;

export function publicMessageForZohoInvoiceStatus(
  status: Extract<ZohoInvoicePaymentPublicStatus, "not_configured" | "not_found" | "error">,
): string {
  return ZOHO_INVOICE_PUBLIC_MESSAGES[status];
}
