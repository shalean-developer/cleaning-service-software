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
  linkMonthlyBillingZohoCustomer,
} from "./customerBillingAccountWriteRepository";
import {
  assertMonthlyBillingAdminMutation,
  failMutation,
  type MonthlyBillingMutationResult,
} from "./customerBillingAccountMutationSupport";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";

export type LinkCustomerZohoCustomerInput = {
  admin: CurrentUser;
  customerId: string;
  zohoCustomerId: string;
  reason: string;
  idempotencyKey: string;
};

export async function linkCustomerZohoCustomer(
  input: LinkCustomerZohoCustomerInput,
): Promise<MonthlyBillingMutationResult> {
  const guard = assertMonthlyBillingAdminMutation(input.admin);
  if (guard) return guard;

  const zohoCustomerId = input.zohoCustomerId.trim();
  if (zohoCustomerId.length < 3) {
    return failMutation("INVALID_PAYLOAD", "zohoCustomerId is required.", 400);
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

  const account = await linkMonthlyBillingZohoCustomer(client, {
    customerId: input.customerId,
    zohoCustomerId,
    billingEmail: beforeAccount?.billingEmail,
    billingTerms: beforeAccount?.billingTerms,
  });

  await recordCustomerBillingAccountAudit(client, {
    accountId: account.id,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "zoho_customer_linked",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    before: accountAuditSnapshot(beforeAccount),
    after: accountAuditSnapshot(account),
  });

  await storeCustomerBillingAccountIdempotency(client, {
    idempotencyKey: input.idempotencyKey,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "zoho_customer_linked",
    result: buildIdempotencyStoredResult({
      action: "zoho_customer_linked",
      customerId: input.customerId,
      account,
    }),
  });

  return { ok: true, account, idempotent: false };
}
