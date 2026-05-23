import "server-only";

const MAX_REFERENCE_LENGTH = 100;

/**
 * Builds a Paystack-safe reference for Zoho invoice checkout.
 * Example: zi_INV_001602_ab12cd34
 */
export function buildZohoInvoicePaystackReference(
  invoiceNumber: string,
  paymentId: string,
): string {
  const compactInvoice = invoiceNumber
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  const suffix = paymentId.replace(/-/g, "").slice(0, 8);
  const reference = `zi_${compactInvoice}_${suffix}`;

  if (reference.length <= MAX_REFERENCE_LENGTH) {
    return reference;
  }

  const maxInvoicePart = MAX_REFERENCE_LENGTH - (`zi__${suffix}`).length;
  const trimmedInvoice = compactInvoice.slice(0, Math.max(1, maxInvoicePart));
  return `zi_${trimmedInvoice}_${suffix}`.slice(0, MAX_REFERENCE_LENGTH);
}
