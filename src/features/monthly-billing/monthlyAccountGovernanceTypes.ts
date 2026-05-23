export const MONTHLY_ACCOUNT_GOVERNANCE_STATES = [
  "approved",
  "account_review_required",
  "finance_hold",
  "disputed",
  "suspended",
] as const;

export type MonthlyAccountGovernanceState = (typeof MONTHLY_ACCOUNT_GOVERNANCE_STATES)[number];

export const MONTHLY_ACCOUNT_EXPOSURE_BANDS = [
  "healthy",
  "warning",
  "elevated",
  "exceeded",
] as const;

export type MonthlyAccountExposureBand = (typeof MONTHLY_ACCOUNT_EXPOSURE_BANDS)[number];

export const MONTHLY_ACCOUNT_EXPOSURE_RECOMMENDATIONS = [
  "continue_normal",
  "monitor",
  "finance_review",
  "manual_override_required",
  "suspend_recommended",
] as const;

export type MonthlyAccountExposureRecommendation =
  (typeof MONTHLY_ACCOUNT_EXPOSURE_RECOMMENDATIONS)[number];

export const MONTHLY_ACCOUNT_FINANCE_REVIEW_STATUSES = [
  "open",
  "resolved",
  "dismissed",
] as const;

export type MonthlyAccountFinanceReviewStatus =
  (typeof MONTHLY_ACCOUNT_FINANCE_REVIEW_STATUSES)[number];

export const CUSTOMER_BILLING_ACCOUNT_GOVERNANCE_AUDIT_ACTIONS = [
  "governance_state_changed",
  "account_suspended",
  "account_unsuspended",
  "finance_review_started",
  "finance_review_completed",
  "finance_review_assigned",
  "finance_review_resolved",
  "finance_review_dismissed",
  "credit_limit_updated",
  "override_granted",
] as const;

export type CustomerBillingAccountGovernanceAuditAction =
  (typeof CUSTOMER_BILLING_ACCOUNT_GOVERNANCE_AUDIT_ACTIONS)[number];

export type MonthlyAccountExposureSnapshot = {
  outstandingBalanceCents: number;
  pendingExposureCents: number;
  totalExposureCents: number;
  creditLimitCents: number | null;
  exposurePercent: number | null;
  exposureBand: MonthlyAccountExposureBand;
  recommendation: MonthlyAccountExposureRecommendation;
  disputedInvoiceCount: number;
  overdueInvoiceCount: number;
};

export type MonthlyGovernanceTimelineEventKind =
  | "governance_state"
  | "credit_limit"
  | "override"
  | "finance_review"
  | "suspension"
  | "note"
  | "dispute";

export type MonthlyGovernanceTimelineEvent = {
  id: string;
  kind: MonthlyGovernanceTimelineEventKind;
  title: string;
  detail: string | null;
  reason: string | null;
  adminProfileId: string | null;
  adminName: string | null;
  at: string;
  metadata: Record<string, unknown>;
};

export const MONTHLY_GOVERNANCE_BULK_ACTIONS = [
  "mark_finance_review",
  "add_note",
  "assign_review_owner",
] as const;

export type MonthlyGovernanceBulkAction = (typeof MONTHLY_GOVERNANCE_BULK_ACTIONS)[number];

export type MonthlyGovernanceInternalAlertKind =
  | "override_expiring_soon"
  | "finance_follow_up_due"
  | "high_risk_unresolved";

export type MonthlyGovernanceInternalAlert = {
  kind: MonthlyGovernanceInternalAlertKind;
  customerId: string;
  customerName: string | null;
  message: string;
};
