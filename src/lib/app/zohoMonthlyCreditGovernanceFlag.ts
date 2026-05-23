import { isZohoMonthlyCollectionsEnabled } from "./zohoMonthlyCollectionsFlag";
import { isZohoMonthlyInvoiceOperationsEnabled } from "./zohoMonthlyInvoiceOperationsFlag";

/**
 * Manual credit governance, exposure visibility, and account review workflows.
 * Requires billing, collections, and invoice operations flags.
 */
export function isZohoMonthlyCreditGovernanceEnabled(): boolean {
  if (!isZohoMonthlyCollectionsEnabled()) {
    return false;
  }
  if (!isZohoMonthlyInvoiceOperationsEnabled()) {
    return false;
  }
  const flag = process.env.ZOHO_MONTHLY_CREDIT_GOVERNANCE_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
