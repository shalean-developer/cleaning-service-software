import { isZohoMonthlyInvoiceOperationsEnabled } from "./zohoMonthlyInvoiceOperationsFlag";

/**
 * Automated invoice delivery and reminder cadence.
 * Requires monthly billing through operations flags.
 */
export function isZohoMonthlyInvoiceAutomationEnabled(): boolean {
  if (!isZohoMonthlyInvoiceOperationsEnabled()) {
    return false;
  }
  const flag = process.env.ZOHO_MONTHLY_INVOICE_AUTOMATION_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
