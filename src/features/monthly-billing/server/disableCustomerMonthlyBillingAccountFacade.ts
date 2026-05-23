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
  disableMonthlyBillingAccount,
} from "./customerBillingAccountWriteRepository";
import {
  assertMonthlyBillingAdminMutation,
  failMutation,
  type MonthlyBillingMutationResult,
} from "./customerBillingAccountMutationSupport";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";

export type DisableCustomerMonthlyBillingAccountInput = {
  admin: CurrentUser;
  customerId: string;
  reason: string;
  idempotencyKey: string;
};

export async function disableCustomerMonthlyBillingAccount(
  input: DisableCustomerMonthlyBillingAccountInput,
): Promise<MonthlyBillingMutationResult> {
  const guard = assertMonthlyBillingAdminMutation(input.admin);
  if (guard) return guard;

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

  const account = await disableMonthlyBillingAccount(client, {
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    reason: input.reason,
  });

  await recordCustomerBillingAccountAudit(client, {
    accountId: account.id,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "monthly_account_disabled",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    before: accountAuditSnapshot(beforeAccount),
    after: accountAuditSnapshot(account),
  });

  await storeCustomerBillingAccountIdempotency(client, {
    idempotencyKey: input.idempotencyKey,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "monthly_account_disabled",
    result: buildIdempotencyStoredResult({
      action: "monthly_account_disabled",
      customerId: input.customerId,
      account,
    }),
  });

  return { ok: true, account, idempotent: false };
}
