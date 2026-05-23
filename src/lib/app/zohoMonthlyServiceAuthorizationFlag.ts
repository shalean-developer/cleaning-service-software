import { isZohoMonthlyAccountBillingEnabled } from "./zohoMonthlyAccountBillingFlag";

/**
 * Admin monthly account service authorization (draft → confirmed without payment).
 * Requires ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED=true as well.
 */
export function isZohoMonthlyServiceAuthorizationEnabled(): boolean {
  if (!isZohoMonthlyAccountBillingEnabled()) {
    return false;
  }
  const flag = process.env.ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
