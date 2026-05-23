import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isZohoMonthlyInvoiceAutomationEnabled } from "@/lib/app/zohoMonthlyInvoiceAutomationFlag";
import { isZohoMonthlyInvoiceOperationsEnabled } from "@/lib/app/zohoMonthlyInvoiceOperationsFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getMonthlyInvoiceBatch } from "./monthlyInvoiceBatchRepository";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import { initializeBatchDeliveryMetadata } from "./monthlyInvoiceDeliveryRepository";
import { readMonthlyInvoiceDeliveryMetadata } from "./monthlyInvoiceDeliveryTypes";
import { sendMonthlyInvoiceToCustomer } from "./sendMonthlyInvoiceToCustomer";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";
import { recordBatchDeliveryFailure } from "./monthlyInvoiceDeliveryRepository";

export type AutoSendMonthlyInvoiceInput = {
  batchId: string;
  client?: SupabaseClient<Database>;
};

export type AutoSendMonthlyInvoiceResult =
  | { ok: true; skipped: false; sent: true }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; code: string; message: string };

export async function autoSendMonthlyInvoiceAfterGeneration(
  input: AutoSendMonthlyInvoiceInput,
): Promise<AutoSendMonthlyInvoiceResult> {
  if (!isZohoMonthlyInvoiceAutomationEnabled() || !isZohoMonthlyInvoiceOperationsEnabled()) {
    return { ok: true, skipped: true, reason: "FEATURE_DISABLED" };
  }

  const client = input.client ?? requireServiceRoleClient();
  let batch = await getMonthlyInvoiceBatch(input.batchId, client);
  if (!batch) {
    return { ok: false, code: "BATCH_NOT_FOUND", message: "Batch not found." };
  }

  if (batch.status !== "generated") {
    return { ok: true, skipped: true, reason: "NOT_GENERATED" };
  }

  const delivery = readMonthlyInvoiceDeliveryMetadata(batch.metadata);
  if (!delivery.autoSendEnabled) {
    return { ok: true, skipped: true, reason: "AUTO_SEND_DISABLED" };
  }

  const billingAccount = await getCustomerBillingAccount(batch.customerId, client);
  if (!billingAccount?.billingEmail?.trim()) {
    await recordCustomerBillingAccountAudit(client, {
      accountId: billingAccount?.id ?? null,
      customerId: batch.customerId,
      adminProfileId: null,
      action: "monthly_invoice_auto_send_failed",
      idempotencyKey: `auto-send-fail:${batch.id}:${new Date().toISOString().slice(0, 10)}`,
      reason: "Missing billing email",
      extra: { batchId: batch.id },
    }).catch(() => undefined);
    return { ok: true, skipped: true, reason: "MISSING_BILLING_EMAIL" };
  }

  const idempotencyKey = `auto-send:${batch.id}`;
  const result = await sendMonthlyInvoiceToCustomer({
    batchId: batch.id,
    adminProfileId: null,
    idempotencyKey,
    source: "auto",
    client,
  });

  if (!result.ok) {
    if (result.code === "INVALID_STATUS" && batch.sentAt) {
      return { ok: true, skipped: true, reason: "ALREADY_SENT" };
    }
    batch = (await getMonthlyInvoiceBatch(batch.id, client)) ?? batch;
    await recordBatchDeliveryFailure(client, batch, { error: result.message }).catch(() => undefined);
    await recordCustomerBillingAccountAudit(client, {
      accountId: billingAccount.id,
      customerId: batch.customerId,
      adminProfileId: null,
      action: "monthly_invoice_auto_send_failed",
      idempotencyKey: `${idempotencyKey}:fail`,
      reason: result.message,
      extra: { batchId: batch.id, code: result.code },
    }).catch(() => undefined);
    return { ok: false, code: result.code, message: result.message };
  }

  return { ok: true, skipped: false, sent: true };
}

export async function runPostGenerationMonthlyInvoiceAutoSend(
  batchId: string,
  client?: SupabaseClient<Database>,
): Promise<void> {
  const serviceClient = client ?? requireServiceRoleClient();
  await initializeBatchDeliveryMetadata(serviceClient, batchId, true).catch(() => undefined);
  await autoSendMonthlyInvoiceAfterGeneration({ batchId, client: serviceClient }).catch(() => undefined);
}
