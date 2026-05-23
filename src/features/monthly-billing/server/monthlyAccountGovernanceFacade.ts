import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type { MonthlyAccountGovernanceState } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  governanceAccountAuditSnapshot,
} from "./customerBillingAccountMapping";
import {
  findGovernanceAuditByIdempotencyKey,
  recordCustomerBillingAccountGovernanceAudit,
  updateCustomerBillingAccountGovernanceFields,
} from "./customerBillingAccountGovernanceRepository";
import {
  buildIdempotencyStoredResult,
  storeCustomerBillingAccountIdempotency,
} from "./customerBillingAccountIdempotency";
import {
  accountAuditSnapshot,
  assertCustomerExists,
} from "./customerBillingAccountWriteRepository";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import {
  failMutation,
  type MonthlyBillingMutationResult,
} from "./customerBillingAccountMutationSupport";
import { assertMonthlyCreditGovernanceAdminMutation } from "./monthlyCreditGovernanceMutationSupport";
import { loadMonthlyAccountExposureForCustomer } from "./loadMonthlyAccountExposure";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";
import { createMonthlyAccountCollectionsNote } from "./monthlyAccountCollectionsNotesRepository";

function governanceAuditActionForTransition(
  previous: MonthlyAccountGovernanceState,
  next: MonthlyAccountGovernanceState,
):
  | "governance_state_changed"
  | "account_suspended"
  | "account_unsuspended"
  | "finance_review_started"
  | "finance_review_completed" {
  if (next === "suspended") return "account_suspended";
  if (previous === "suspended") return "account_unsuspended";
  if (next === "account_review_required") return "finance_review_started";
  if (previous === "account_review_required" && next === "approved") {
    return "finance_review_completed";
  }
  return "governance_state_changed";
}

function noteTypeForGovernanceState(state: MonthlyAccountGovernanceState) {
  switch (state) {
    case "suspended":
      return "suspension_reason" as const;
    case "finance_hold":
      return "finance_hold" as const;
    case "disputed":
      return "dispute_resolution" as const;
    case "account_review_required":
      return "governance_review" as const;
    default:
      return "governance_review" as const;
  }
}

export type UpdateMonthlyAccountGovernanceStateInput = {
  admin: CurrentUser;
  customerId: string;
  governanceState: MonthlyAccountGovernanceState;
  reason: string;
  idempotencyKey: string;
  confirmAction: true;
};

export async function updateMonthlyAccountGovernanceState(
  input: UpdateMonthlyAccountGovernanceStateInput,
): Promise<MonthlyBillingMutationResult> {
  const guard = assertMonthlyCreditGovernanceAdminMutation(input.admin);
  if (guard) return guard;

  if (input.confirmAction !== true) {
    return failMutation("INVALID_PAYLOAD", "confirmAction must be true.", 400);
  }
  if (!input.reason.trim()) {
    return failMutation("INVALID_PAYLOAD", "reason is required.", 400);
  }

  const client = requireServiceRoleClient();
  const priorAudit = await findGovernanceAuditByIdempotencyKey(client, input.idempotencyKey);
  if (priorAudit) {
    const account = await getCustomerBillingAccount(input.customerId, client);
    if (account) return { ok: true, account, idempotent: true };
  }

  const customerExists = await assertCustomerExists(client, input.customerId);
  if (!customerExists) {
    return failMutation("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }

  const beforeAccount = await getCustomerBillingAccount(input.customerId, client);
  if (!beforeAccount) {
    return failMutation("ACCOUNT_NOT_FOUND", "Billing account not found.", 404);
  }

  const previousState = beforeAccount.governanceState;
  if (previousState === input.governanceState) {
    return { ok: true, account: beforeAccount, idempotent: true };
  }

  const exposure = await loadMonthlyAccountExposureForCustomer(
    input.customerId,
    beforeAccount,
    client,
  );
  const now = new Date().toISOString();
  const isSuspending = input.governanceState === "suspended";
  const isUnsuspending = previousState === "suspended" && input.governanceState !== "suspended";
  const isFinanceReviewStart = input.governanceState === "account_review_required";
  const isFinanceReviewComplete =
    previousState === "account_review_required" && input.governanceState === "approved";

  await updateCustomerBillingAccountGovernanceFields(client, {
    accountId: beforeAccount.id,
    governanceState: input.governanceState,
    suspendedAt: isSuspending ? now : isUnsuspending ? null : beforeAccount.suspendedAt,
    suspendedByAdminId: isSuspending
      ? input.admin.profileId
      : isUnsuspending
        ? null
        : beforeAccount.suspendedByAdminId,
    suspensionReason: isSuspending
      ? input.reason.trim()
      : isUnsuspending
        ? null
        : beforeAccount.suspensionReason,
    lastFinanceReviewAt:
      isFinanceReviewStart || isFinanceReviewComplete ? now : beforeAccount.lastFinanceReviewAt,
    lastFinanceReviewBy:
      isFinanceReviewStart || isFinanceReviewComplete
        ? input.admin.profileId
        : beforeAccount.lastFinanceReviewBy,
    financeReviewStatus: isFinanceReviewStart
      ? "open"
      : isFinanceReviewComplete
        ? "resolved"
        : beforeAccount.financeReviewStatus,
    financeReviewOwnerAdminId: isFinanceReviewStart
      ? input.admin.profileId
      : beforeAccount.financeReviewOwnerAdminId,
    financeReviewResolution: isFinanceReviewComplete
      ? input.reason.trim()
      : beforeAccount.financeReviewResolution,
  });

  const refreshed = await getCustomerBillingAccount(input.customerId, client);
  if (!refreshed) {
    return failMutation("PERSISTENCE_ERROR", "Could not reload billing account.", 500);
  }
  const account = refreshed;

  await recordCustomerBillingAccountGovernanceAudit(client, {
    accountId: account.id,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: governanceAuditActionForTransition(previousState, input.governanceState),
    previousState,
    nextState: input.governanceState,
    reason: input.reason,
    exposureSnapshot: exposure,
    outstandingBalanceSnapshot: exposure.outstandingBalanceCents,
    idempotencyKey: input.idempotencyKey,
  });

  await recordCustomerBillingAccountAudit(client, {
    accountId: account.id,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "monthly_account_governance_state_changed",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    before: governanceAccountAuditSnapshot(beforeAccount),
    after: governanceAccountAuditSnapshot(account),
    extra: { previousState, nextState: input.governanceState },
  });

  await createMonthlyAccountCollectionsNote({
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    noteType: noteTypeForGovernanceState(input.governanceState),
    content: input.reason.trim(),
    idempotencyKey: `${input.idempotencyKey}:note`,
    reviewOwnerAdminId: input.admin.profileId,
  }).catch(() => undefined);

  await storeCustomerBillingAccountIdempotency(client, {
    idempotencyKey: input.idempotencyKey,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "monthly_account_governance_state_changed",
    result: buildIdempotencyStoredResult({
      action: "monthly_account_governance_state_changed",
      customerId: input.customerId,
      account,
    }),
  });

  return { ok: true, account, idempotent: false };
}

export type UpdateMonthlyAccountCreditLimitInput = {
  admin: CurrentUser;
  customerId: string;
  creditLimitCents: number | null;
  reason: string;
  idempotencyKey: string;
  confirmAction: true;
};

export async function updateMonthlyAccountCreditLimit(
  input: UpdateMonthlyAccountCreditLimitInput,
): Promise<MonthlyBillingMutationResult> {
  const guard = assertMonthlyCreditGovernanceAdminMutation(input.admin);
  if (guard) return guard;

  if (input.confirmAction !== true) {
    return failMutation("INVALID_PAYLOAD", "confirmAction must be true.", 400);
  }
  if (!input.reason.trim()) {
    return failMutation("INVALID_PAYLOAD", "reason is required.", 400);
  }
  if (input.creditLimitCents != null && input.creditLimitCents < 0) {
    return failMutation("INVALID_PAYLOAD", "creditLimitCents must be non-negative.", 400);
  }

  const client = requireServiceRoleClient();
  const priorAudit = await findGovernanceAuditByIdempotencyKey(client, input.idempotencyKey);
  if (priorAudit) {
    const account = await getCustomerBillingAccount(input.customerId, client);
    if (account) return { ok: true, account, idempotent: true };
  }

  const beforeAccount = await getCustomerBillingAccount(input.customerId, client);
  if (!beforeAccount) {
    return failMutation("ACCOUNT_NOT_FOUND", "Billing account not found.", 404);
  }

  if (beforeAccount.creditLimitCents === input.creditLimitCents) {
    return { ok: true, account: beforeAccount, idempotent: true };
  }

  const exposure = await loadMonthlyAccountExposureForCustomer(
    input.customerId,
    beforeAccount,
    client,
  );

  await updateCustomerBillingAccountGovernanceFields(client, {
    accountId: beforeAccount.id,
    creditLimitCents: input.creditLimitCents,
  });

  const account = await getCustomerBillingAccount(input.customerId, client);
  if (!account) {
    return failMutation("PERSISTENCE_ERROR", "Could not reload billing account.", 500);
  }

  await recordCustomerBillingAccountGovernanceAudit(client, {
    accountId: account.id,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "credit_limit_updated",
    previousState: beforeAccount.governanceState,
    nextState: account.governanceState,
    reason: input.reason,
    exposureSnapshot: exposure,
    outstandingBalanceSnapshot: exposure.outstandingBalanceCents,
    idempotencyKey: input.idempotencyKey,
  });

  await recordCustomerBillingAccountAudit(client, {
    accountId: account.id,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "monthly_account_credit_limit_updated",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    before: accountAuditSnapshot(beforeAccount),
    after: accountAuditSnapshot(account),
    extra: {
      previousCreditLimitCents: beforeAccount.creditLimitCents,
      nextCreditLimitCents: input.creditLimitCents,
    },
  });

  await createMonthlyAccountCollectionsNote({
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    noteType: "credit_limit_review",
    content: input.reason.trim(),
    idempotencyKey: `${input.idempotencyKey}:note`,
    reviewOwnerAdminId: input.admin.profileId,
  }).catch(() => undefined);

  await storeCustomerBillingAccountIdempotency(client, {
    idempotencyKey: input.idempotencyKey,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "monthly_account_credit_limit_updated",
    result: buildIdempotencyStoredResult({
      action: "monthly_account_credit_limit_updated",
      customerId: input.customerId,
      account,
    }),
  });

  return { ok: true, account, idempotent: false };
}

export type GrantMonthlyAccountTemporaryOverrideInput = {
  admin: CurrentUser;
  customerId: string;
  manualOverrideUntil: string;
  reason: string;
  idempotencyKey: string;
  confirmAction: true;
};

export async function grantMonthlyAccountTemporaryOverride(
  input: GrantMonthlyAccountTemporaryOverrideInput,
): Promise<MonthlyBillingMutationResult> {
  const guard = assertMonthlyCreditGovernanceAdminMutation(input.admin);
  if (guard) return guard;

  if (input.confirmAction !== true) {
    return failMutation("INVALID_PAYLOAD", "confirmAction must be true.", 400);
  }
  if (!input.reason.trim()) {
    return failMutation("INVALID_PAYLOAD", "reason is required.", 400);
  }

  const overrideUntil = new Date(input.manualOverrideUntil);
  if (Number.isNaN(overrideUntil.getTime())) {
    return failMutation("INVALID_PAYLOAD", "manualOverrideUntil must be a valid ISO timestamp.", 400);
  }
  if (overrideUntil.getTime() <= Date.now()) {
    return failMutation("INVALID_PAYLOAD", "manualOverrideUntil must be in the future.", 400);
  }

  const client = requireServiceRoleClient();
  const priorAudit = await findGovernanceAuditByIdempotencyKey(client, input.idempotencyKey);
  if (priorAudit) {
    const account = await getCustomerBillingAccount(input.customerId, client);
    if (account) return { ok: true, account, idempotent: true };
  }

  const beforeAccount = await getCustomerBillingAccount(input.customerId, client);
  if (!beforeAccount) {
    return failMutation("ACCOUNT_NOT_FOUND", "Billing account not found.", 404);
  }

  const isoOverrideUntil = overrideUntil.toISOString();
  if (beforeAccount.manualOverrideUntil === isoOverrideUntil) {
    return { ok: true, account: beforeAccount, idempotent: true };
  }

  const exposure = await loadMonthlyAccountExposureForCustomer(
    input.customerId,
    beforeAccount,
    client,
  );

  await updateCustomerBillingAccountGovernanceFields(client, {
    accountId: beforeAccount.id,
    manualOverrideUntil: isoOverrideUntil,
  });

  const account = await getCustomerBillingAccount(input.customerId, client);
  if (!account) {
    return failMutation("PERSISTENCE_ERROR", "Could not reload billing account.", 500);
  }

  await recordCustomerBillingAccountGovernanceAudit(client, {
    accountId: account.id,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "override_granted",
    previousState: beforeAccount.governanceState,
    nextState: account.governanceState,
    reason: input.reason,
    exposureSnapshot: exposure,
    outstandingBalanceSnapshot: exposure.outstandingBalanceCents,
    idempotencyKey: input.idempotencyKey,
  });

  await recordCustomerBillingAccountAudit(client, {
    accountId: account.id,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "monthly_account_override_granted",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    before: governanceAccountAuditSnapshot(beforeAccount),
    after: governanceAccountAuditSnapshot(account),
    extra: { manualOverrideUntil: isoOverrideUntil },
  });

  await createMonthlyAccountCollectionsNote({
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    noteType: "override_approval",
    content: input.reason.trim(),
    idempotencyKey: `${input.idempotencyKey}:note`,
    reviewOwnerAdminId: input.admin.profileId,
    followUpDate: isoOverrideUntil.slice(0, 10),
  }).catch(() => undefined);

  await storeCustomerBillingAccountIdempotency(client, {
    idempotencyKey: input.idempotencyKey,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "monthly_account_override_granted",
    result: buildIdempotencyStoredResult({
      action: "monthly_account_override_granted",
      customerId: input.customerId,
      account,
    }),
  });

  return { ok: true, account, idempotent: false };
}
