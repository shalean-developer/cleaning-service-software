import "server-only";

import type { MonthlyGovernanceDashboard } from "./loadMonthlyGovernanceDashboard";
import { computeOverrideExpiryInfo } from "./computeOverrideExpiryInfo";
import { formatFinanceReviewStatusLabel, formatRiskRecommendationLabel } from "./formatGovernanceDisplayLabels";

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function overrideStatusLabel(row: MonthlyGovernanceDashboard["customers"][number]): string {
  if (!row.manualOverrideUntil) return "none";
  return computeOverrideExpiryInfo(row.manualOverrideUntil).state;
}

export function buildMonthlyGovernanceExportRows(
  dashboard: MonthlyGovernanceDashboard,
  customerIds?: string[],
): Record<string, string | number | null>[] {
  const selected = customerIds?.length
    ? dashboard.customers.filter((row) => customerIds.includes(row.customerId))
    : dashboard.customers;

  return selected.map((row) => ({
    customer_id: row.customerId,
    customer_name: row.customerName,
    governance_state: row.governanceState,
    credit_limit_cents: row.creditLimitCents,
    outstanding_balance_cents: row.outstandingBalanceCents,
    pending_exposure_cents: row.exposure.pendingExposureCents,
    exposure_percent: row.exposure.exposurePercent,
    risk_score: row.riskScore,
    recommendation: formatRiskRecommendationLabel(row.recommendation),
    override_status: overrideStatusLabel(row),
    review_owner_admin_id: row.financeReviewOwnerAdminId,
    follow_up_date: row.financeReviewFollowUpDate,
    review_status: row.financeReviewStatus
      ? formatFinanceReviewStatusLabel(row.financeReviewStatus)
      : null,
    last_action_at: row.lastActionAt,
    notes_count: row.notesCount,
  }));
}

export function buildMonthlyGovernanceCsv(
  dashboard: MonthlyGovernanceDashboard,
  customerIds?: string[],
): string {
  const rows = buildMonthlyGovernanceExportRows(dashboard, customerIds);
  const headers = [
    "customer_id",
    "customer_name",
    "governance_state",
    "credit_limit_cents",
    "outstanding_balance_cents",
    "pending_exposure_cents",
    "exposure_percent",
    "risk_score",
    "recommendation",
    "override_status",
    "review_owner_admin_id",
    "follow_up_date",
    "review_status",
    "last_action_at",
    "notes_count",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((header) => {
          const value = row[header];
          if (value == null) return "";
          if (typeof value === "string") return csvEscape(value);
          return String(value);
        })
        .join(","),
    );
  }
  return lines.join("\n");
}

export function buildMonthlyGovernanceJson(
  dashboard: MonthlyGovernanceDashboard,
  customerIds?: string[],
): string {
  return JSON.stringify(buildMonthlyGovernanceExportRows(dashboard, customerIds), null, 2);
}
