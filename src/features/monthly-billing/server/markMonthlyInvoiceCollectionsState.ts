import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getMonthlyInvoiceBatch } from "./monthlyInvoiceBatchRepository";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import { updateBatchDeliveryMetadata } from "./monthlyInvoiceDeliveryRepository";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";

export async function markMonthlyInvoiceFinanceReview(input: {
  batchId: string;
  adminProfileId: string;
  idempotencyKey: string;
  reason?: string;
  client?: SupabaseClient<Database>;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const client = input.client ?? requireServiceRoleClient();
  const batch = await getMonthlyInvoiceBatch(input.batchId, client);
  if (!batch) return { ok: false, code: "BATCH_NOT_FOUND", message: "Batch not found." };

  const account = await getCustomerBillingAccount(batch.customerId, client);
  await updateBatchDeliveryMetadata(client, batch, { collectionsState: "finance_review" });
  await recordCustomerBillingAccountAudit(client, {
    accountId: account?.id ?? null,
    customerId: batch.customerId,
    adminProfileId: input.adminProfileId,
    action: "monthly_invoice_finance_review",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason ?? null,
    extra: { batchId: batch.id },
  }).catch(() => undefined);

  return { ok: true };
}

export async function markMonthlyInvoiceDisputed(input: {
  batchId: string;
  adminProfileId: string;
  idempotencyKey: string;
  reason?: string;
  client?: SupabaseClient<Database>;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const client = input.client ?? requireServiceRoleClient();
  const batch = await getMonthlyInvoiceBatch(input.batchId, client);
  if (!batch) return { ok: false, code: "BATCH_NOT_FOUND", message: "Batch not found." };

  const account = await getCustomerBillingAccount(batch.customerId, client);
  await updateBatchDeliveryMetadata(client, batch, { collectionsState: "disputed" });
  await recordCustomerBillingAccountAudit(client, {
    accountId: account?.id ?? null,
    customerId: batch.customerId,
    adminProfileId: input.adminProfileId,
    action: "monthly_invoice_disputed",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason ?? null,
    extra: { batchId: batch.id },
  }).catch(() => undefined);

  return { ok: true };
}
