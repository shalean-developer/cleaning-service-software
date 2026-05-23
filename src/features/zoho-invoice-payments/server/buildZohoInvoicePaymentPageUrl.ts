import { normalizeAppBaseUrl } from "@/lib/app/paymentReturn";

/** Builds the public Shalean payment page URL for a normalized invoice number. */
export function buildZohoInvoicePaymentPageUrl(
  appBaseUrl: string,
  normalizedInvoiceNumber: string,
): string {
  const encoded = encodeURIComponent(normalizedInvoiceNumber.trim());
  return `${normalizeAppBaseUrl(appBaseUrl)}/pay/${encoded}`;
}
