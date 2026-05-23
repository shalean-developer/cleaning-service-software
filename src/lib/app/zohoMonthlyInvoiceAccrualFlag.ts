import { isZohoMonthlyServiceAuthorizationEnabled } from "./zohoMonthlyServiceAuthorizationFlag";

/**
 * Post-completion monthly invoice batch item accrual.
 * Requires monthly billing + service authorization flags as well.
 */
export function isZohoMonthlyInvoiceAccrualEnabled(): boolean {
  if (!isZohoMonthlyServiceAuthorizationEnabled()) {
    return false;
  }
  const flag = process.env.ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
