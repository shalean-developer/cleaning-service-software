import { resolveNotificationAppBaseUrl } from "@/lib/app/appBaseUrl";
import { normalizeAppBaseUrl } from "@/lib/app/paymentReturn";

export function buildZohoInvoicePaystackCallbackUrl(
  invoiceNumber: string,
  reference: string,
): string | null {
  const base = resolveNotificationAppBaseUrl()?.trim();
  if (!base) return null;

  const encodedInvoice = encodeURIComponent(invoiceNumber.trim());
  const encodedReference = encodeURIComponent(reference.trim());
  return `${normalizeAppBaseUrl(base)}/pay/${encodedInvoice}/success?reference=${encodedReference}`;
}
