import type {
  MonthlyAccountExposureBand,
  MonthlyAccountExposureRecommendation,
  MonthlyAccountExposureSnapshot,
} from "../monthlyAccountGovernanceTypes";

export type MonthlyAccountExposureInput = {
  outstandingBalanceCents: number;
  pendingExposureCents: number;
  creditLimitCents: number | null;
  disputedInvoiceCount: number;
  overdueInvoiceCount: number;
  governanceState?: string;
};

function clampPercent(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

export function computeMonthlyAccountExposure(
  input: MonthlyAccountExposureInput,
): MonthlyAccountExposureSnapshot {
  const outstandingBalanceCents = Math.max(0, input.outstandingBalanceCents);
  const pendingExposureCents = Math.max(0, input.pendingExposureCents);
  const totalExposureCents = outstandingBalanceCents + pendingExposureCents;
  const creditLimitCents = input.creditLimitCents;

  let exposurePercent: number | null = null;
  if (creditLimitCents != null && creditLimitCents > 0) {
    exposurePercent = clampPercent((totalExposureCents / creditLimitCents) * 100);
  }

  let exposureBand: MonthlyAccountExposureBand = "healthy";
  if (exposurePercent != null) {
    if (exposurePercent > 100) exposureBand = "exceeded";
    else if (exposurePercent >= 90) exposureBand = "elevated";
    else if (exposurePercent >= 70) exposureBand = "warning";
  } else if (totalExposureCents > 0 && input.overdueInvoiceCount > 0) {
    exposureBand = "warning";
  }

  let recommendation: MonthlyAccountExposureRecommendation = "continue_normal";
  if (input.governanceState === "suspended") {
    recommendation = "suspend_recommended";
  } else if (exposureBand === "exceeded") {
    recommendation = "manual_override_required";
  } else if (
    input.disputedInvoiceCount > 0 ||
    input.governanceState === "disputed" ||
    input.governanceState === "finance_hold"
  ) {
    recommendation = "finance_review";
  } else if (exposureBand === "elevated" || input.governanceState === "account_review_required") {
    recommendation = "finance_review";
  } else if (exposureBand === "warning" || input.overdueInvoiceCount > 0) {
    recommendation = "monitor";
  }

  return {
    outstandingBalanceCents,
    pendingExposureCents,
    totalExposureCents,
    creditLimitCents,
    exposurePercent,
    exposureBand,
    recommendation,
    disputedInvoiceCount: input.disputedInvoiceCount,
    overdueInvoiceCount: input.overdueInvoiceCount,
  };
}

export function requiresElevatedExposureConfirmation(
  exposure: MonthlyAccountExposureSnapshot,
  overrideActive: boolean,
): boolean {
  if (overrideActive) return false;
  return exposure.exposureBand === "elevated" || exposure.exposureBand === "exceeded";
}
