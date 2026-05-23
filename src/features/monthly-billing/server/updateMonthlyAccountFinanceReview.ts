import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type { MonthlyAccountFinanceReviewStatus } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  findGovernanceAuditByIdempotencyKey,
  recordCustomerBillingAccountGovernanceAudit,
  updateCustomerBillingAccountGovernanceFields,
} from "./customerBillingAccountGovernanceRepository";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import {
  failMutation,
  type MonthlyBillingMutationResult,
} from "./customerBillingAccountMutationSupport";
import { assertMonthlyCreditGovernanceAdminMutation } from "./monthlyCreditGovernanceMutationSupport";
import { loadMonthlyAccountExposureForCustomer } from "./loadMonthlyAccountExposure";
import { createMonthlyAccountCollectionsNote } from "./monthlyAccountCollectionsNotesRepository";

export type UpdateMonthlyAccountFinanceReviewInput = {
  admin: CurrentUser;
  customerId: string;
  reason: string;
  idempotencyKey: string;
  confirmAction: true;
  reviewOwnerAdminId?: string | null;
  followUpDate?: string | null;
  reviewStatus?: MonthlyAccountFinanceReviewStatus;
  resolution?: string | null;
};

function financeReviewAuditAction(
  input: UpdateMonthlyAccountFinanceReviewInput,
): "finance_review_assigned" | "finance_review_resolved" | "finance_review_dismissed" | "finance_review_started" {
  if (input.reviewStatus === "resolved") return "finance_review_resolved";
  if (input.reviewStatus === "dismissed") return "finance_review_dismissed";
  if (input.reviewOwnerAdminId !== undefined || input.followUpDate !== undefined) {
    return "finance_review_assigned";
  }
  return "finance_review_started";
}

export async function updateMonthlyAccountFinanceReview(
  input: UpdateMonthlyAccountFinanceReviewInput,
): Promise<MonthlyBillingMutationResult> {
  const guard = assertMonthlyCreditGovernanceAdminMutation(input.admin);
  if (guard) return guard;

  if (input.confirmAction !== true) {
    return failMutation("INVALID_PAYLOAD", "confirmAction must be true.", 400);
  }
  if (!input.reason.trim()) {
    return failMutation("INVALID_PAYLOAD", "reason is required.", 400);
  }

  const hasMutation =
    input.reviewOwnerAdminId !== undefined ||
    input.followUpDate !== undefined ||
    input.reviewStatus !== undefined ||
    input.resolution !== undefined;

  if (!hasMutation) {
    return failMutation("INVALID_PAYLOAD", "At least one finance review field is required.", 400);
  }

  if (input.reviewStatus === "dismissed" && !input.resolution?.trim()) {
    return failMutation("INVALID_PAYLOAD", "resolution is required when dismissing a review.", 400);
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

  const exposure = await loadMonthlyAccountExposureForCustomer(
    input.customerId,
    beforeAccount,
    client,
  );

  const patch: Parameters<typeof updateCustomerBillingAccountGovernanceFields>[1] = {
    accountId: beforeAccount.id,
  };

  if (input.reviewOwnerAdminId !== undefined) {
    patch.financeReviewOwnerAdminId = input.reviewOwnerAdminId;
  }
  if (input.followUpDate !== undefined) {
    patch.financeReviewFollowUpDate = input.followUpDate;
  }
  if (input.resolution !== undefined) {
    patch.financeReviewResolution = input.resolution;
  }
  if (input.reviewStatus !== undefined) {
    patch.financeReviewStatus = input.reviewStatus;
    if (input.reviewStatus === "open") {
      patch.lastFinanceReviewAt = new Date().toISOString();
      patch.lastFinanceReviewBy = input.admin.profileId;
    }
  } else if (
    input.reviewOwnerAdminId !== undefined ||
    input.followUpDate !== undefined
  ) {
    if (!beforeAccount.financeReviewStatus) {
      patch.financeReviewStatus = "open";
      patch.lastFinanceReviewAt = new Date().toISOString();
      patch.lastFinanceReviewBy = input.admin.profileId;
    }
  }

  await updateCustomerBillingAccountGovernanceFields(client, patch);

  const account = await getCustomerBillingAccount(input.customerId, client);
  if (!account) {
    return failMutation("PERSISTENCE_ERROR", "Could not reload billing account.", 500);
  }

  await recordCustomerBillingAccountGovernanceAudit(client, {
    accountId: account.id,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: financeReviewAuditAction(input),
    previousState: beforeAccount.governanceState,
    nextState: account.governanceState,
    reason: input.reason,
    exposureSnapshot: exposure,
    outstandingBalanceSnapshot: exposure.outstandingBalanceCents,
    idempotencyKey: input.idempotencyKey,
  });

  await createMonthlyAccountCollectionsNote({
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    noteType: "finance_review",
    content: input.reason.trim(),
    idempotencyKey: `${input.idempotencyKey}:note`,
    reviewOwnerAdminId: input.reviewOwnerAdminId ?? account.financeReviewOwnerAdminId,
    followUpDate: input.followUpDate ?? account.financeReviewFollowUpDate,
    resolution: input.resolution ?? account.financeReviewResolution,
  }).catch(() => undefined);

  return { ok: true, account, idempotent: false };
}
