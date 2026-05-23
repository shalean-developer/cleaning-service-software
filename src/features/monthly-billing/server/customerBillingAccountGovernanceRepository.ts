import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CustomerBillingAccountGovernanceAuditAction,
  CustomerBillingAccountGovernanceAuditRow,
  Database,
  Json,
  MonthlyAccountGovernanceState,
} from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { MonthlyAccountExposureSnapshot } from "../monthlyAccountGovernanceTypes";

export type CustomerBillingAccountGovernanceAuditEntry = {
  id: string;
  accountId: string;
  customerId: string;
  adminProfileId: string;
  action: CustomerBillingAccountGovernanceAuditAction;
  previousState: string | null;
  nextState: string | null;
  reason: string;
  exposureSnapshot: Record<string, unknown>;
  outstandingBalanceSnapshot: number | null;
  idempotencyKey: string | null;
  createdAt: string;
};

function mapRow(row: CustomerBillingAccountGovernanceAuditRow): CustomerBillingAccountGovernanceAuditEntry {
  return {
    id: row.id,
    accountId: row.account_id,
    customerId: row.customer_id,
    adminProfileId: row.admin_profile_id,
    action: row.action,
    previousState: row.previous_state,
    nextState: row.next_state,
    reason: row.reason,
    exposureSnapshot: (row.exposure_snapshot ?? {}) as Record<string, unknown>,
    outstandingBalanceSnapshot: row.outstanding_balance_snapshot,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}

export async function findGovernanceAuditByIdempotencyKey(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<CustomerBillingAccountGovernanceAuditEntry | null> {
  const { data, error } = await client
    .from("customer_billing_account_governance_audit")
    .select("*")
    .eq("idempotency_key", idempotencyKey.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRow(data as CustomerBillingAccountGovernanceAuditRow) : null;
}

export async function recordCustomerBillingAccountGovernanceAudit(
  client: SupabaseClient<Database>,
  input: {
    accountId: string;
    customerId: string;
    adminProfileId: string;
    action: CustomerBillingAccountGovernanceAuditAction;
    previousState: MonthlyAccountGovernanceState | null;
    nextState: MonthlyAccountGovernanceState | null;
    reason: string;
    exposureSnapshot: MonthlyAccountExposureSnapshot | Record<string, unknown>;
    outstandingBalanceSnapshot: number | null;
    idempotencyKey?: string | null;
  },
): Promise<CustomerBillingAccountGovernanceAuditEntry> {
  const { data, error } = await client
    .from("customer_billing_account_governance_audit")
    .insert({
      account_id: input.accountId,
      customer_id: input.customerId,
      admin_profile_id: input.adminProfileId,
      action: input.action,
      previous_state: input.previousState,
      next_state: input.nextState,
      reason: input.reason.trim(),
      exposure_snapshot: input.exposureSnapshot as Json,
      outstanding_balance_snapshot: input.outstandingBalanceSnapshot,
      idempotency_key: input.idempotencyKey?.trim() || null,
    })
    .select("*")
    .single();

  if (error?.code === "23505" && input.idempotencyKey) {
    const prior = await findGovernanceAuditByIdempotencyKey(client, input.idempotencyKey);
    if (prior) return prior;
  }
  if (error) throw new Error(error.message);
  return mapRow(data as CustomerBillingAccountGovernanceAuditRow);
}

export async function listGovernanceAuditForCustomer(
  customerId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
  limit = 100,
): Promise<CustomerBillingAccountGovernanceAuditEntry[]> {
  const capped = Math.min(Math.max(limit, 1), 200);
  const { data, error } = await client
    .from("customer_billing_account_governance_audit")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(capped);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as CustomerBillingAccountGovernanceAuditRow));
}

export async function updateCustomerBillingAccountGovernanceFields(
  client: SupabaseClient<Database>,
  input: {
    accountId: string;
    governanceState?: MonthlyAccountGovernanceState;
    creditLimitCents?: number | null;
    manualOverrideUntil?: string | null;
    suspendedAt?: string | null;
    suspendedByAdminId?: string | null;
    suspensionReason?: string | null;
    lastFinanceReviewAt?: string | null;
    lastFinanceReviewBy?: string | null;
    financeReviewStatus?: string | null;
    financeReviewOwnerAdminId?: string | null;
    financeReviewFollowUpDate?: string | null;
    financeReviewResolution?: string | null;
  },
) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.governanceState !== undefined) patch.governance_state = input.governanceState;
  if (input.creditLimitCents !== undefined) patch.credit_limit_cents = input.creditLimitCents;
  if (input.manualOverrideUntil !== undefined) patch.manual_override_until = input.manualOverrideUntil;
  if (input.suspendedAt !== undefined) patch.suspended_at = input.suspendedAt;
  if (input.suspendedByAdminId !== undefined) patch.suspended_by_admin_id = input.suspendedByAdminId;
  if (input.suspensionReason !== undefined) patch.suspension_reason = input.suspensionReason;
  if (input.lastFinanceReviewAt !== undefined) patch.last_finance_review_at = input.lastFinanceReviewAt;
  if (input.lastFinanceReviewBy !== undefined) patch.last_finance_review_by = input.lastFinanceReviewBy;
  if (input.financeReviewStatus !== undefined) patch.finance_review_status = input.financeReviewStatus;
  if (input.financeReviewOwnerAdminId !== undefined) {
    patch.finance_review_owner_admin_id = input.financeReviewOwnerAdminId;
  }
  if (input.financeReviewFollowUpDate !== undefined) {
    patch.finance_review_follow_up_date = input.financeReviewFollowUpDate;
  }
  if (input.financeReviewResolution !== undefined) {
    patch.finance_review_resolution = input.financeReviewResolution;
  }

  const { data, error } = await client
    .from("customer_billing_accounts")
    .update(patch)
    .eq("id", input.accountId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
