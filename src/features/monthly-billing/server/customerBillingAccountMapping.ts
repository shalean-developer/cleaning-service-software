import type { CustomerBillingAccountRow } from "@/lib/database/types";
import type { CustomerBillingAccount } from "./monthlyBillingTypes";

export function mapCustomerBillingAccountRow(row: CustomerBillingAccountRow): CustomerBillingAccount {
  return {
    id: row.id,
    customerId: row.customer_id,
    billingMode: row.billing_mode,
    zohoCustomerId: row.zoho_customer_id,
    billingEmail: row.billing_email,
    billingTerms: row.billing_terms,
    isMonthlyAccountEnabled: row.is_monthly_account_enabled,
    approvedByAdminId: row.approved_by_admin_id,
    approvedAt: row.approved_at,
    approvalReason: row.approval_reason,
    disabledAt: row.disabled_at,
    disabledByAdminId: row.disabled_by_admin_id,
    governanceState: row.governance_state ?? "approved",
    creditLimitCents: row.credit_limit_cents,
    manualOverrideUntil: row.manual_override_until,
    suspendedAt: row.suspended_at,
    suspendedByAdminId: row.suspended_by_admin_id,
    suspensionReason: row.suspension_reason,
    lastFinanceReviewAt: row.last_finance_review_at,
    lastFinanceReviewBy: row.last_finance_review_by,
    financeReviewStatus: row.finance_review_status ?? null,
    financeReviewOwnerAdminId: row.finance_review_owner_admin_id,
    financeReviewFollowUpDate: row.finance_review_follow_up_date,
    financeReviewResolution: row.finance_review_resolution,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isMonthlyAccountOverrideActive(account: CustomerBillingAccount, now = new Date()): boolean {
  if (!account.manualOverrideUntil) return false;
  return new Date(account.manualOverrideUntil).getTime() > now.getTime();
}

export function governanceAccountAuditSnapshot(account: CustomerBillingAccount | null) {
  if (!account) return null;
  return {
    governanceState: account.governanceState,
    creditLimitCents: account.creditLimitCents,
    manualOverrideUntil: account.manualOverrideUntil,
    suspendedAt: account.suspendedAt,
    lastFinanceReviewAt: account.lastFinanceReviewAt,
    financeReviewStatus: account.financeReviewStatus,
    financeReviewOwnerAdminId: account.financeReviewOwnerAdminId,
    financeReviewFollowUpDate: account.financeReviewFollowUpDate,
  };
}
