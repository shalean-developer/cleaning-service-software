/**
 * Stage 1D: customer self-signup is off unless explicitly enabled.
 * Set ENABLE_CUSTOMER_SIGNUP=true (or 1 / yes) after Stage 1C provisioning is verified.
 */
export function isCustomerSignupEnabled(): boolean {
  const flag = process.env.ENABLE_CUSTOMER_SIGNUP?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
