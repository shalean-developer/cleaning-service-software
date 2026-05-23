import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import {
  buildIdempotencyStoredResult,
  findCustomerBillingAccountIdempotency,
  storeCustomerBillingAccountIdempotency,
} from "./customerBillingAccountIdempotency";
import {
  accountAuditSnapshot,
  assertCustomerExists,
  updateMonthlyBillingAccountTerms,
} from "./customerBillingAccountWriteRepository";
import {
  assertMonthlyBillingAdminMutation,
  failMutation,
  isValidBillingEmail,
  type MonthlyBillingMutationResult,
} from "./customerBillingAccountMutationSupport";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";

export type UpdateCustomerBillingTermsInput = {
  admin: CurrentUser;
  customerId: string;
  billingEmail: string;
  billingTerms: string;
  reason: string;
  idempotencyKey: string;
};

export async function updateCustomerBillingTerms(
  input: UpdateCustomerBillingTermsInput,
): Promise<MonthlyBillingMutationResult> {
  const guard = assertMonthlyBillingAdminMutation(input.admin);
  if (guard) return guard;

  if (!isValidBillingEmail(input.billingEmail)) {
    return failMutation("INVALID_PAYLOAD", "billingEmail must be a valid email address.", 400);
  }
  if (!input.billingTerms.trim()) {
    return failMutation("INVALID_PAYLOAD", "billingTerms is required.", 400);
  }
  if (!input.reason.trim()) {
    return failMutation("INVALID_PAYLOAD", "reason is required.", 400);
  }

  const client = requireServiceRoleClient();

  const prior = await findCustomerBillingAccountIdempotency(client, input.idempotencyKey);
  if (prior) {
    const account = await getCustomerBillingAccount(prior.customerId, client);
    if (account) {
      return { ok: true, account, idempotent: true };
    }
  }

  const customerExists = await assertCustomerExists(client, input.customerId);
  if (!customerExists) {
    return failMutation("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }

  const beforeAccount = await getCustomerBillingAccount(input.customerId, client);
  if (!beforeAccount) {
    return failMutation("ACCOUNT_NOT_FOUND", "Billing account not found.", 404);
  }

  const account = await updateMonthlyBillingAccountTerms(client, {
    customerId: input.customerId,
    billingEmail: input.billingEmail,
    billingTerms: input.billingTerms,
  });

  await recordCustomerBillingAccountAudit(client, {
    accountId: account.id,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "billing_terms_updated",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    before: accountAuditSnapshot(beforeAccount),
    after: accountAuditSnapshot(account),
  });

  await storeCustomerBillingAccountIdempotency(client, {
    idempotencyKey: input.idempotencyKey,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "billing_terms_updated",
    result: buildIdempotencyStoredResult({
      action: "billing_terms_updated",
      customerId: input.customerId,
      account,
    }),
  });

  return { ok: true, account, idempotent: false };
}
