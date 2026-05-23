import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { isZohoMonthlyCreditGovernanceEnabled } from "@/lib/app/zohoMonthlyCreditGovernanceFlag";
import type { MonthlyBillingMutationFailure } from "./customerBillingAccountMutationSupport";
import { failMutation } from "./customerBillingAccountMutationSupport";

export function assertMonthlyCreditGovernanceAdminMutation(
  admin: CurrentUser,
): MonthlyBillingMutationFailure | null {
  if (admin.role !== "admin") {
    return failMutation("FORBIDDEN", "Admins only.", 403);
  }
  if (!isZohoMonthlyCreditGovernanceEnabled()) {
    return failMutation(
      "FEATURE_DISABLED",
      "Monthly credit governance is disabled (ZOHO_MONTHLY_CREDIT_GOVERNANCE_ENABLED).",
      403,
    );
  }
  return null;
}
