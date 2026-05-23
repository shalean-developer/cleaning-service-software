import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { isZohoMonthlyAccountBillingEnabled } from "@/lib/app/zohoMonthlyAccountBillingFlag";
import type { CustomerBillingAccount } from "./monthlyBillingTypes";

export type MonthlyBillingMutationFailure = {
  ok: false;
  code: string;
  message: string;
  status: number;
};

export type MonthlyBillingMutationSuccess = {
  ok: true;
  account: CustomerBillingAccount;
  idempotent: boolean;
};

export type MonthlyBillingMutationResult = MonthlyBillingMutationSuccess | MonthlyBillingMutationFailure;

export function failMutation(
  code: string,
  message: string,
  status: number,
): MonthlyBillingMutationFailure {
  return { ok: false, code, message, status };
}

export function assertMonthlyBillingAdminMutation(
  admin: CurrentUser,
): MonthlyBillingMutationFailure | null {
  if (admin.role !== "admin") {
    return failMutation("FORBIDDEN", "Admins only.", 403);
  }
  if (!isZohoMonthlyAccountBillingEnabled()) {
    return failMutation(
      "FEATURE_DISABLED",
      "Monthly account billing setup is disabled (ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED).",
      403,
    );
  }
  return null;
}

export function isValidBillingEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
