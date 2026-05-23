/**
 * Admin monthly account billing setup (enable/disable customer eligibility).
 * Read-only surfaces remain visible when false; mutations require this flag.
 */
export function isZohoMonthlyAccountBillingEnabled(): boolean {
  const flag = process.env.ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
