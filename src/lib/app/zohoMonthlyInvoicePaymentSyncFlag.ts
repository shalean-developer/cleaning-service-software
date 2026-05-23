import { isZohoMonthlyInvoiceGenerationEnabled } from "./zohoMonthlyInvoiceGenerationFlag";

/**
 * Sync Zoho invoice payment status into monthly invoice batches.
 * Requires monthly billing + invoice generation flags as well.
 */
export function isZohoMonthlyInvoicePaymentSyncEnabled(): boolean {
  if (!isZohoMonthlyInvoiceGenerationEnabled()) {
    return false;
  }
  const flag = process.env.ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
