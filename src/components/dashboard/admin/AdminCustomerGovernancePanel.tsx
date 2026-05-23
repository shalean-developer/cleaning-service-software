"use client";

import Link from "next/link";
import { AdminDetailSection } from "@/components/dashboard/admin/AdminDetailSection";
import { AdminMonthlyGovernanceTimeline } from "@/components/dashboard/admin/AdminMonthlyGovernanceTimeline";
import { computeOverrideExpiryInfo } from "@/features/monthly-billing/server/computeOverrideExpiryInfo";
import {
  formatFinanceReviewStatusLabel,
  formatGovernanceStateLabel,
  formatMonthlyGovernanceZar,
  formatRiskRecommendationLabel,
} from "@/features/monthly-billing/server/formatGovernanceDisplayLabels";
import type { MonthlyGovernanceTimelineEvent } from "@/features/monthly-billing/monthlyAccountGovernanceTypes";
import type { CustomerBillingAccount } from "@/features/monthly-billing/server/monthlyBillingTypes";
import type { MonthlyAccountExposureSnapshot } from "@/features/monthly-billing/monthlyAccountGovernanceTypes";

type Props = {
  customerId: string;
  account: CustomerBillingAccount;
  exposure: MonthlyAccountExposureSnapshot;
  riskScore: number;
  riskLevel: string;
  recommendation: string;
  timeline: MonthlyGovernanceTimelineEvent[];
};

export function AdminCustomerGovernancePanel({
  customerId,
  account,
  exposure,
  riskScore,
  riskLevel,
  recommendation,
  timeline,
}: Props) {
  const overrideInfo = computeOverrideExpiryInfo(account.manualOverrideUntil);

  return (
    <AdminDetailSection
      title="Monthly account governance"
      description="Read-only governance snapshot and activity timeline. All state changes remain manual from the governance dashboard."
    >
      <div className="space-y-3 text-sm" data-testid="customer-governance-panel">
        <p>
          State: <strong>{formatGovernanceStateLabel(account.governanceState)}</strong> · Review:{" "}
          <strong>{formatFinanceReviewStatusLabel(account.financeReviewStatus)}</strong>
        </p>
        <p className="text-zinc-600">
          Outstanding {formatMonthlyGovernanceZar(exposure.outstandingBalanceCents)} · Pending{" "}
          {formatMonthlyGovernanceZar(exposure.pendingExposureCents)} · Limit{" "}
          {formatMonthlyGovernanceZar(account.creditLimitCents)} · Exposure{" "}
          {exposure.exposurePercent != null ? `${exposure.exposurePercent}%` : "—"} ({exposure.exposureBand})
        </p>
        <p className="text-xs text-zinc-500">
          Risk {riskScore} ({riskLevel}) · {formatRiskRecommendationLabel(recommendation as never)}
        </p>
        {account.manualOverrideUntil ? (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${overrideInfo.badgeClass}`}>
            {overrideInfo.label}
          </span>
        ) : null}
        <Link
          href="/admin/operations/monthly-governance"
          className="inline-block text-xs text-blue-700 underline"
        >
          Open monthly governance dashboard
        </Link>
        <AdminMonthlyGovernanceTimeline events={timeline} compact />
      </div>
    </AdminDetailSection>
  );
}
