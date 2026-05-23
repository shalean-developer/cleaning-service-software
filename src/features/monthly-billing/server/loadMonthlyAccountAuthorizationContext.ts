import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isZohoMonthlyCreditGovernanceEnabled } from "@/lib/app/zohoMonthlyCreditGovernanceFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isMonthlyAccountOverrideActive } from "./customerBillingAccountMapping";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import { loadMonthlyAccountExposureForCustomer } from "./loadMonthlyAccountExposure";
import {
  computeMonthlyAccountRiskScore,
  type MonthlyAccountRiskRecommendation,
} from "./computeMonthlyAccountRiskScore";
import { readMonthlyInvoiceDeliveryMetadata } from "./monthlyInvoiceDeliveryTypes";
import { listMonthlyInvoiceBatches } from "./monthlyInvoiceBatchRepository";
import type { MonthlyAccountExposureSnapshot } from "../monthlyAccountGovernanceTypes";
import type { CustomerBillingAccount } from "./monthlyBillingTypes";
import { requiresElevatedExposureConfirmation } from "./computeMonthlyAccountExposure";

export type MonthlyAccountAuthorizationContext = {
  governanceEnabled: boolean;
  account: CustomerBillingAccount | null;
  exposure: MonthlyAccountExposureSnapshot | null;
  overrideActive: boolean;
  requiresElevatedConfirmation: boolean;
  riskScore: number | null;
  riskLevel: string | null;
  recommendation: MonthlyAccountRiskRecommendation | null;
  warnings: string[];
  lastPaymentAt: string | null;
};

export async function loadMonthlyAccountAuthorizationContext(
  customerId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyAccountAuthorizationContext> {
  const governanceEnabled = isZohoMonthlyCreditGovernanceEnabled();
  const account = await getCustomerBillingAccount(customerId, client);

  if (!governanceEnabled || !account) {
    return {
      governanceEnabled,
      account,
      exposure: null,
      overrideActive: false,
      requiresElevatedConfirmation: false,
      riskScore: null,
      riskLevel: null,
      recommendation: null,
      warnings: [],
      lastPaymentAt: null,
    };
  }

  const exposureResult = await loadMonthlyAccountExposureForCustomer(customerId, account, client);
  const { lastPaymentAt, ...exposure } = exposureResult;
  const overrideActive = isMonthlyAccountOverrideActive(account);
  const requiresElevatedConfirmation = requiresElevatedExposureConfirmation(exposure, overrideActive);

  const batches = await listMonthlyInvoiceBatches({ customerId, limit: 200 }, client);
  let reminderCount = 0;
  let failedDeliveryCount = 0;
  let recentPaidCount30d = 0;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  for (const batch of batches) {
    const delivery = readMonthlyInvoiceDeliveryMetadata(batch.metadata);
    reminderCount += delivery.reminderCount;
    failedDeliveryCount += delivery.deliveryFailures;
    if (batch.paidAt && new Date(batch.paidAt).getTime() >= thirtyDaysAgo) {
      recentPaidCount30d += 1;
    }
  }

  const risk = computeMonthlyAccountRiskScore({
    overdueInvoiceCount: exposure.overdueInvoiceCount,
    averageDaysLate: exposure.overdueInvoiceCount > 0 ? 14 : 0,
    unpaidBalanceCents: exposure.outstandingBalanceCents,
    reminderCount,
    disputedInvoiceCount: exposure.disputedInvoiceCount,
    failedDeliveryCount,
    recentPaidCount30d,
  });

  const warnings: string[] = [];
  if (exposure.exposureBand === "exceeded") {
    warnings.push("Exposure exceeds recommended limit.");
  }
  if (exposure.recommendation === "finance_review" || account.governanceState === "account_review_required") {
    warnings.push("Finance review recommended.");
  }
  if (account.governanceState === "finance_hold") {
    warnings.push("Customer account on finance hold.");
  }
  if (account.governanceState === "suspended") {
    warnings.push("Account is suspended for new monthly service authorization.");
  }
  if (overrideActive && account.manualOverrideUntil) {
    warnings.push(`Temporary override active until ${account.manualOverrideUntil}.`);
  }

  return {
    governanceEnabled,
    account,
    exposure,
    overrideActive,
    requiresElevatedConfirmation,
    riskScore: risk.score,
    riskLevel: risk.level,
    recommendation: risk.recommendation,
    warnings,
    lastPaymentAt,
  };
}
