import type { MonthlyAccountExposureRecommendation } from "../monthlyAccountGovernanceTypes";
import type { MonthlyAccountRiskRecommendation } from "./computeMonthlyAccountRiskScore";

const EXPOSURE_LABELS: Record<MonthlyAccountExposureRecommendation, string> = {
  continue_normal: "Continue normal monitoring",
  monitor: "Monitor account activity",
  finance_review: "Schedule finance review",
  manual_override_required: "Manual override required before new authorization",
  suspend_recommended: "Suspension recommended (manual action only)",
};

const RISK_LABELS: Record<MonthlyAccountRiskRecommendation, string> = {
  continue_normal: "Collections healthy",
  monitor: "Monitor collections activity",
  finance_review: "Finance review recommended",
  manual_followup: "Manual follow-up recommended",
  account_review_recommended: "Account review recommended",
};

export function formatExposureRecommendationLabel(
  recommendation: MonthlyAccountExposureRecommendation,
): string {
  return EXPOSURE_LABELS[recommendation] ?? recommendation;
}

export function formatRiskRecommendationLabel(
  recommendation: MonthlyAccountRiskRecommendation,
): string {
  return RISK_LABELS[recommendation] ?? recommendation;
}

export function formatGovernanceStateLabel(state: string): string {
  switch (state) {
    case "approved":
      return "Approved";
    case "account_review_required":
      return "Finance review required";
    case "finance_hold":
      return "Finance hold";
    case "disputed":
      return "Disputed";
    case "suspended":
      return "Suspended";
    default:
      return state.replace(/_/g, " ");
  }
}

export function formatFinanceReviewStatusLabel(status: string | null): string {
  switch (status) {
    case "open":
      return "Open review";
    case "resolved":
      return "Resolved";
    case "dismissed":
      return "Dismissed";
    default:
      return "No active review";
  }
}

export function formatMonthlyGovernanceZar(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function creditLimitReviewHint(input: {
  creditLimitCents: number | null;
  exposurePercent: number | null;
  exposureBand: string;
  overdueInvoiceCount: number;
}): string | null {
  if (input.creditLimitCents == null) {
    return "No credit limit set — consider defining a limit for exposure tracking.";
  }
  if (input.exposureBand === "exceeded" || (input.exposurePercent ?? 0) >= 90) {
    return "Recommended limit review — exposure is near or above the current limit.";
  }
  if (input.overdueInvoiceCount > 0 && (input.exposurePercent ?? 0) >= 70) {
    return "Recommended limit review — overdue invoices with elevated exposure.";
  }
  return null;
}
