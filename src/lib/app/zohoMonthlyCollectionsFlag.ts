import { isZohoMonthlyAccountBillingEnabled } from "./zohoMonthlyAccountBillingFlag";

/**
 * Collections dashboard, risk scoring, and finance workflow tooling.
 * Requires monthly account billing flag only (read-only when automation off).
 */
export function isZohoMonthlyCollectionsEnabled(): boolean {
  if (!isZohoMonthlyAccountBillingEnabled()) {
    return false;
  }
  const flag = process.env.ZOHO_MONTHLY_COLLECTIONS_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
