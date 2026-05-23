import "server-only";

import { isZohoMonthlyCreditGovernanceEnabled } from "@/lib/app/zohoMonthlyCreditGovernanceFlag";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import { loadMonthlyAccountExposureForCustomer } from "./loadMonthlyAccountExposure";
import { loadMonthlyGovernanceTimelineForCustomer } from "./loadMonthlyGovernanceTimelineForCustomer";
import { computeMonthlyAccountRiskScore } from "./computeMonthlyAccountRiskScore";
import { listMonthlyInvoiceBatches } from "./monthlyInvoiceBatchRepository";
import { readMonthlyInvoiceDeliveryMetadata } from "./monthlyInvoiceDeliveryTypes";

export async function loadCustomerGovernancePanelContext(customerId: string) {
  if (!isZohoMonthlyCreditGovernanceEnabled()) return null;

  const account = await getCustomerBillingAccount(customerId);
  if (!account?.isMonthlyAccountEnabled) return null;

  const exposureResult = await loadMonthlyAccountExposureForCustomer(customerId, account);
  const { lastPaymentAt: _lastPaymentAt, ...exposure } = exposureResult;

  const batches = await listMonthlyInvoiceBatches({ customerId, limit: 200 });
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

  const timeline = await loadMonthlyGovernanceTimelineForCustomer(customerId, undefined, 50);

  return {
    account,
    exposure,
    riskScore: risk.score,
    riskLevel: risk.level,
    recommendation: risk.recommendation,
    timeline,
  };
}
