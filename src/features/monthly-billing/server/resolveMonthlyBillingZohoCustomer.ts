import "server-only";

import { findOrCreateZohoCustomer } from "@/lib/zoho/customers";
import { isZohoBooksEnabled } from "@/lib/zoho/zohoEnv";

export type ResolveMonthlyBillingZohoCustomerInput = {
  billingEmail: string;
  displayName?: string | null;
  zohoCustomerId?: string | null;
  createZohoCustomer?: boolean;
};

export type ResolveMonthlyBillingZohoCustomerResult =
  | { ok: true; zohoCustomerId: string | null; zohoContactName: string | null; created: boolean }
  | { ok: false; code: string; message: string; status: number };

export async function resolveMonthlyBillingZohoCustomer(
  input: ResolveMonthlyBillingZohoCustomerInput,
): Promise<ResolveMonthlyBillingZohoCustomerResult> {
  const explicitId = input.zohoCustomerId?.trim();
  if (explicitId) {
    if (explicitId.length < 3) {
      return {
        ok: false,
        code: "INVALID_ZOHO_CUSTOMER_ID",
        message: "Zoho customer id must be at least 3 characters.",
        status: 400,
      };
    }
    return { ok: true, zohoCustomerId: explicitId, zohoContactName: null, created: false };
  }

  if (!input.createZohoCustomer) {
    return { ok: true, zohoCustomerId: null, zohoContactName: null, created: false };
  }

  if (!isZohoBooksEnabled()) {
    return {
      ok: false,
      code: "ZOHO_UNAVAILABLE",
      message:
        "Zoho Books is not configured. Provide an existing zohoCustomerId or configure Zoho credentials.",
      status: 503,
    };
  }

  const result = await findOrCreateZohoCustomer({
    email: input.billingEmail,
    displayName: input.displayName,
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: `Could not create or find Zoho customer (${result.code}).`,
      status: result.retryable ? 503 : 400,
    };
  }

  return {
    ok: true,
    zohoCustomerId: result.customerId,
    zohoContactName: result.contactName,
    created: true,
  };
}
