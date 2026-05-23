import { isZohoMonthlyInvoiceAccrualEnabled } from "./zohoMonthlyInvoiceAccrualFlag";

/**
 * Consolidated Zoho invoice generation from monthly invoice batches.
 * Requires monthly billing + accrual flags as well.
 */
export function isZohoMonthlyInvoiceGenerationEnabled(): boolean {
  if (!isZohoMonthlyInvoiceAccrualEnabled()) {
    return false;
  }
  const flag = process.env.ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
