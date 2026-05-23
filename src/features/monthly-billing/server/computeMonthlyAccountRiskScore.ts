import "server-only";

export type MonthlyAccountRiskLevel = "low" | "medium" | "high" | "critical";

export type MonthlyAccountRiskRecommendation =
  | "continue_normal"
  | "monitor"
  | "finance_review"
  | "manual_followup"
  | "account_review_recommended";

export type MonthlyAccountRiskInput = {
  overdueInvoiceCount: number;
  averageDaysLate: number;
  unpaidBalanceCents: number;
  reminderCount: number;
  disputedInvoiceCount: number;
  failedDeliveryCount: number;
  recentPaidCount30d: number;
};

export type MonthlyAccountRiskResult = {
  score: number;
  level: MonthlyAccountRiskLevel;
  recommendation: MonthlyAccountRiskRecommendation;
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeMonthlyAccountRiskScore(
  input: MonthlyAccountRiskInput,
): MonthlyAccountRiskResult {
  let score = 0;

  score += Math.min(input.overdueInvoiceCount * 18, 36);
  score += Math.min(input.averageDaysLate * 1.2, 30);
  score += Math.min(input.unpaidBalanceCents / 10000, 20);
  score += Math.min(input.reminderCount * 4, 16);
  score += Math.min(input.disputedInvoiceCount * 20, 40);
  score += Math.min(input.failedDeliveryCount * 6, 18);
  score -= Math.min(input.recentPaidCount30d * 8, 24);

  const normalized = clampScore(score);

  let level: MonthlyAccountRiskLevel = "low";
  if (normalized >= 75) level = "critical";
  else if (normalized >= 55) level = "high";
  else if (normalized >= 30) level = "medium";

  let recommendation: MonthlyAccountRiskRecommendation = "continue_normal";
  if (input.disputedInvoiceCount > 0) recommendation = "finance_review";
  else if (level === "critical") recommendation = "account_review_recommended";
  else if (level === "high") recommendation = "manual_followup";
  else if (level === "medium") recommendation = "monitor";

  return { score: normalized, level, recommendation };
}
