import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CustomerBillingAccountAuditAction,
  Database,
  Json,
} from "@/lib/database/types";
import type { CustomerBillingAccount } from "./monthlyBillingTypes";

export type CustomerBillingAccountIdempotencyStoredResult = {
  action: CustomerBillingAccountAuditAction;
  customerId: string;
  accountId: string;
  idempotent: boolean;
};

function parseStoredResult(raw: unknown): CustomerBillingAccountIdempotencyStoredResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.action !== "string" || typeof row.customerId !== "string") return null;
  if (typeof row.accountId !== "string") return null;
  return {
    action: row.action as CustomerBillingAccountAuditAction,
    customerId: row.customerId,
    accountId: row.accountId,
    idempotent: true,
  };
}

export async function findCustomerBillingAccountIdempotency(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<CustomerBillingAccountIdempotencyStoredResult | null> {
  const { data, error } = await client
    .from("customer_billing_account_idempotency")
    .select("result")
    .eq("idempotency_key", idempotencyKey.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return parseStoredResult(data?.result);
}

export async function storeCustomerBillingAccountIdempotency(
  client: SupabaseClient<Database>,
  input: {
    idempotencyKey: string;
    customerId: string;
    adminProfileId: string;
    action: CustomerBillingAccountAuditAction;
    result: CustomerBillingAccountIdempotencyStoredResult;
  },
): Promise<void> {
  const payload = {
    action: input.result.action,
    customerId: input.result.customerId,
    accountId: input.result.accountId,
    idempotent: input.result.idempotent,
  } satisfies Json;

  const { error } = await client.from("customer_billing_account_idempotency").insert({
    idempotency_key: input.idempotencyKey.trim(),
    customer_id: input.customerId,
    admin_profile_id: input.adminProfileId,
    action: input.action,
    result: payload,
  });

  if (error?.code === "23505") return;
  if (error) throw new Error(error.message);
}

export function buildIdempotencyStoredResult(input: {
  action: CustomerBillingAccountAuditAction;
  customerId: string;
  account: CustomerBillingAccount;
}): CustomerBillingAccountIdempotencyStoredResult {
  return {
    action: input.action,
    customerId: input.customerId,
    accountId: input.account.id,
    idempotent: false,
  };
}
