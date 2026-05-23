import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerBillingAccountAuditAction, Database, Json } from "@/lib/database/types";

export const MONTHLY_BILLING_AUDIT_SOURCE = "admin_monthly_billing" as const;

export type RecordCustomerBillingAccountAuditInput = {
  accountId: string | null;
  customerId: string;
  adminProfileId: string | null;
  action: CustomerBillingAccountAuditAction;
  idempotencyKey: string;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  extra?: Record<string, unknown>;
};

export async function recordCustomerBillingAccountAudit(
  client: SupabaseClient<Database>,
  input: RecordCustomerBillingAccountAuditInput,
): Promise<void> {
  const payload = {
    source: MONTHLY_BILLING_AUDIT_SOURCE,
    idempotencyKey: input.idempotencyKey.trim(),
    reason: input.reason?.trim() || null,
    before: input.before ?? null,
    after: input.after ?? null,
    ...input.extra,
  } satisfies Record<string, unknown>;

  const { error } = await client.from("customer_billing_account_audit").insert({
    account_id: input.accountId,
    customer_id: input.customerId,
    admin_profile_id: input.adminProfileId,
    action: input.action,
    payload: payload as Json,
  });

  if (error) throw new Error(error.message);
}
