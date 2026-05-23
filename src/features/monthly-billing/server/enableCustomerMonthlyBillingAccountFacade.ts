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
  loadCustomerDisplayName,
  upsertEnabledMonthlyBillingAccount,
} from "./customerBillingAccountWriteRepository";
import {
  assertMonthlyBillingAdminMutation,
  failMutation,
  isValidBillingEmail,
  type MonthlyBillingMutationResult,
} from "./customerBillingAccountMutationSupport";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";
import { resolveMonthlyBillingZohoCustomer } from "./resolveMonthlyBillingZohoCustomer";

export type EnableCustomerMonthlyBillingAccountInput = {
  admin: CurrentUser;
  customerId: string;
  billingEmail: string;
  billingTerms: string;
  approvalReason: string;
  idempotencyKey: string;
  zohoCustomerId?: string;
  createZohoCustomer?: boolean;
};

export async function enableCustomerMonthlyBillingAccount(
  input: EnableCustomerMonthlyBillingAccountInput,
): Promise<MonthlyBillingMutationResult> {
  const guard = assertMonthlyBillingAdminMutation(input.admin);
  if (guard) return guard;

  if (!isValidBillingEmail(input.billingEmail)) {
    return failMutation("INVALID_PAYLOAD", "billingEmail must be a valid email address.", 400);
  }
  if (!input.billingTerms.trim()) {
    return failMutation("INVALID_PAYLOAD", "billingTerms is required.", 400);
  }
  if (!input.approvalReason.trim()) {
    return failMutation("INVALID_PAYLOAD", "approvalReason is required.", 400);
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
  const displayName = await loadCustomerDisplayName(client, input.customerId);

  const zohoResult = await resolveMonthlyBillingZohoCustomer({
    billingEmail: input.billingEmail,
    displayName,
    zohoCustomerId: input.zohoCustomerId,
    createZohoCustomer: input.createZohoCustomer,
  });

  if (!zohoResult.ok) {
    return failMutation(zohoResult.code, zohoResult.message, zohoResult.status);
  }

  const account = await upsertEnabledMonthlyBillingAccount(client, {
    customerId: input.customerId,
    billingEmail: input.billingEmail,
    billingTerms: input.billingTerms,
    approvalReason: input.approvalReason,
    adminProfileId: input.admin.profileId,
    zohoCustomerId: zohoResult.zohoCustomerId,
  });

  await recordCustomerBillingAccountAudit(client, {
    accountId: account.id,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "monthly_account_enabled",
    idempotencyKey: input.idempotencyKey,
    reason: input.approvalReason,
    before: accountAuditSnapshot(beforeAccount),
    after: accountAuditSnapshot(account),
    extra: {
      zohoCustomerCreated: zohoResult.created,
      zohoContactName: zohoResult.zohoContactName,
    },
  });

  const stored = buildIdempotencyStoredResult({
    action: "monthly_account_enabled",
    customerId: input.customerId,
    account,
  });

  await storeCustomerBillingAccountIdempotency(client, {
    idempotencyKey: input.idempotencyKey,
    customerId: input.customerId,
    adminProfileId: input.admin.profileId,
    action: "monthly_account_enabled",
    result: stored,
  });

  return { ok: true, account, idempotent: false };
}
