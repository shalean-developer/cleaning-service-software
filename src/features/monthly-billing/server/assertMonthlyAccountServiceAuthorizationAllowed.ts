import "server-only";

import type { CustomerBillingAccount } from "./monthlyBillingTypes";
import { isMonthlyAccountOverrideActive } from "./customerBillingAccountMapping";
import {
  computeMonthlyAccountExposure,
  requiresElevatedExposureConfirmation,
  type MonthlyAccountExposureInput,
} from "./computeMonthlyAccountExposure";
import type { MonthlyAccountExposureSnapshot } from "../monthlyAccountGovernanceTypes";

export const ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION =
  "ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION" as const;

export type MonthlyAccountAuthorizationGateInput = {
  account: CustomerBillingAccount;
  exposure: MonthlyAccountExposureInput;
  confirmElevatedExposure?: boolean;
};

export type MonthlyAccountAuthorizationGateResult =
  | {
      ok: true;
      exposure: MonthlyAccountExposureSnapshot;
      overrideActive: boolean;
      warnings: string[];
    }
  | {
      ok: false;
      code:
        | typeof ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION
        | "ELEVATED_EXPOSURE_CONFIRMATION_REQUIRED";
      message: string;
    };

export function assertMonthlyAccountServiceAuthorizationAllowed(
  input: MonthlyAccountAuthorizationGateInput,
): MonthlyAccountAuthorizationGateResult {
  const exposure = computeMonthlyAccountExposure(input.exposure);
  const overrideActive = isMonthlyAccountOverrideActive(input.account);
  const warnings: string[] = [];

  if (input.account.governanceState === "suspended") {
    return {
      ok: false,
      code: ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION,
      message:
        "Monthly account is suspended. Remove suspension before authorizing new monthly services.",
    };
  }

  if (exposure.exposureBand === "exceeded") {
    warnings.push("Exposure exceeds recommended limit.");
  }
  if (
    exposure.recommendation === "finance_review" ||
    input.account.governanceState === "account_review_required"
  ) {
    warnings.push("Finance review recommended.");
  }
  if (input.account.governanceState === "finance_hold") {
    warnings.push("Customer account on finance hold.");
  }
  if (input.account.governanceState === "disputed" || exposure.disputedInvoiceCount > 0) {
    warnings.push("Active invoice disputes require finance attention.");
  }
  if (overrideActive && input.account.manualOverrideUntil) {
    warnings.push(`Temporary override active until ${input.account.manualOverrideUntil}.`);
  }

  if (
    requiresElevatedExposureConfirmation(exposure, overrideActive) &&
    input.confirmElevatedExposure !== true
  ) {
    return {
      ok: false,
      code: "ELEVATED_EXPOSURE_CONFIRMATION_REQUIRED",
      message:
        "Elevated or exceeded exposure requires confirmElevatedExposure before authorizing service.",
    };
  }

  return { ok: true, exposure, overrideActive, warnings };
}
