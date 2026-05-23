import { isZohoMonthlyInvoicePaymentSyncEnabled } from "./zohoMonthlyInvoicePaymentSyncFlag";

/**
 * Month-end invoice operations: send invoice, reminders, overdue handling, customer visibility.
 * Requires monthly billing + generation + payment sync flags as well.
 */
export function isZohoMonthlyInvoiceOperationsEnabled(): boolean {
  if (!isZohoMonthlyInvoicePaymentSyncEnabled()) {
    return false;
  }
  const flag = process.env.ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
