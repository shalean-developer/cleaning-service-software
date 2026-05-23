import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import {
  failMutation,
  type MonthlyBillingMutationResult,
} from "./customerBillingAccountMutationSupport";
import { assertMonthlyCreditGovernanceAdminMutation } from "./monthlyCreditGovernanceMutationSupport";
import { createMonthlyAccountCollectionsNote } from "./monthlyAccountCollectionsNotesRepository";
import { updateMonthlyAccountGovernanceState } from "./monthlyAccountGovernanceFacade";
import { updateMonthlyAccountFinanceReview } from "./updateMonthlyAccountFinanceReview";
import type { MonthlyGovernanceBulkAction } from "../monthlyAccountGovernanceTypes";

export type ExecuteMonthlyGovernanceBulkActionInput = {
  admin: CurrentUser;
  action: MonthlyGovernanceBulkAction;
  customerIds: string[];
  reason: string;
  idempotencyKey: string;
  confirmAction: true;
  reviewOwnerAdminId?: string | null;
  followUpDate?: string | null;
  noteContent?: string;
};

export type MonthlyGovernanceBulkActionResult = {
  ok: true;
  processed: number;
  failed: { customerId: string; message: string }[];
};

const FORBIDDEN_BULK_ACTIONS = [
  "bulk_suspend",
  "bulk_unsuspend",
  "bulk_override",
  "bulk_credit_limit",
] as const;

export function assertAllowedBulkAction(action: string): action is MonthlyGovernanceBulkAction {
  if ((FORBIDDEN_BULK_ACTIONS as readonly string[]).includes(action)) return false;
  return action === "mark_finance_review" || action === "add_note" || action === "assign_review_owner";
}

export async function executeMonthlyGovernanceBulkAction(
  input: ExecuteMonthlyGovernanceBulkActionInput,
): Promise<MonthlyGovernanceBulkActionResult | ReturnType<typeof failMutation>> {
  const guard = assertMonthlyCreditGovernanceAdminMutation(input.admin);
  if (guard) return guard;

  if (input.confirmAction !== true) {
    return failMutation("INVALID_PAYLOAD", "confirmAction must be true.", 400);
  }
  if (!input.reason.trim()) {
    return failMutation("INVALID_PAYLOAD", "reason is required.", 400);
  }
  if (!assertAllowedBulkAction(input.action)) {
    return failMutation("FORBIDDEN_BULK_ACTION", "Bulk action is not permitted.", 403);
  }
  if (input.customerIds.length === 0) {
    return failMutation("INVALID_PAYLOAD", "customerIds must not be empty.", 400);
  }
  if (input.customerIds.length > 50) {
    return failMutation("INVALID_PAYLOAD", "Bulk actions are limited to 50 accounts.", 400);
  }

  const failed: { customerId: string; message: string }[] = [];
  let processed = 0;

  for (const [index, customerId] of input.customerIds.entries()) {
    const itemKey = `${input.idempotencyKey}:${index}:${customerId}`;
    let result: MonthlyBillingMutationResult | { ok: true };

    switch (input.action) {
      case "mark_finance_review":
        result = await updateMonthlyAccountGovernanceState({
          admin: input.admin,
          customerId,
          governanceState: "account_review_required",
          reason: input.reason.trim(),
          idempotencyKey: `${itemKey}:review`,
          confirmAction: true,
        });
        break;
      case "add_note":
        try {
          await createMonthlyAccountCollectionsNote({
            customerId,
            adminProfileId: input.admin.profileId,
            noteType: "governance_review",
            content: (input.noteContent?.trim() || input.reason.trim()),
            idempotencyKey: `${itemKey}:note`,
            reviewOwnerAdminId: input.reviewOwnerAdminId ?? input.admin.profileId,
            followUpDate: input.followUpDate ?? null,
          });
          result = { ok: true };
        } catch {
          result = failMutation("PERSISTENCE_ERROR", "Could not save note.", 500);
        }
        break;
      case "assign_review_owner":
        if (!input.reviewOwnerAdminId) {
          result = failMutation("INVALID_PAYLOAD", "reviewOwnerAdminId is required.", 400);
        } else {
          result = await updateMonthlyAccountFinanceReview({
            admin: input.admin,
            customerId,
            reason: input.reason.trim(),
            idempotencyKey: `${itemKey}:assign`,
            confirmAction: true,
            reviewOwnerAdminId: input.reviewOwnerAdminId,
            followUpDate: input.followUpDate ?? null,
            reviewStatus: "open",
          });
        }
        break;
      default:
        result = failMutation("FORBIDDEN_BULK_ACTION", "Bulk action is not permitted.", 403);
    }

    if (!result.ok) {
      failed.push({ customerId, message: result.message });
    } else {
      processed += 1;
    }
  }

  return { ok: true, processed, failed };
}
