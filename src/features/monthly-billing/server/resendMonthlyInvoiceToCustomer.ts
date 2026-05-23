import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isZohoMonthlyInvoiceOperationsEnabled } from "@/lib/app/zohoMonthlyInvoiceOperationsFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import {
  enqueueMonthlyInvoiceNotification,
  resolveMonthlyInvoiceDueDate,
  resolveMonthlyInvoicePaymentLink,
} from "./enqueueMonthlyInvoiceNotification";
import { loadBatchForOperations } from "./monthlyInvoiceOperationsRepository";
import { recordBatchDeliveryQueued } from "./monthlyInvoiceDeliveryRepository";
import { isReminderEligibleBatchStatus, isTerminalInvoiceOperationsStatus } from "./monthlyInvoiceOperationsTypes";
import { MONTHLY_INVOICE_SENT_TEMPLATE } from "./monthlyInvoiceNotificationTemplate";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";

export type ResendMonthlyInvoiceInput = {
  batchId: string;
  adminProfileId: string | null;
  idempotencyKey: string;
  reason?: string;
  client?: SupabaseClient<Database>;
};

export type ResendMonthlyInvoiceResult =
  | { ok: true; notificationOutboxId: string }
  | { ok: false; code: string; message: string };

export async function resendMonthlyInvoiceToCustomer(
  input: ResendMonthlyInvoiceInput,
): Promise<ResendMonthlyInvoiceResult> {
  if (!isZohoMonthlyInvoiceOperationsEnabled()) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "Monthly invoice operations are disabled.",
    };
  }

  const client = input.client ?? requireServiceRoleClient();
  const loaded = await loadBatchForOperations(input.batchId, client);
  if (!loaded) {
    return { ok: false, code: "BATCH_NOT_FOUND", message: "Batch not found." };
  }

  const { batch } = loaded;
  if (isTerminalInvoiceOperationsStatus(batch.status)) {
    return { ok: false, code: "INVALID_STATUS", message: `Cannot resend for status ${batch.status}.` };
  }

  if (!isReminderEligibleBatchStatus(batch.status) && batch.status !== "generated") {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "Invoice must be sent or overdue to resend.",
    };
  }

  const invoiceNumber = batch.zohoInvoiceNumber?.trim();
  if (!invoiceNumber) {
    return { ok: false, code: "MISSING_INVOICE_NUMBER", message: "Missing invoice number." };
  }

  const billingAccount = await getCustomerBillingAccount(batch.customerId, client);
  if (!billingAccount?.billingEmail?.trim()) {
    return { ok: false, code: "MISSING_BILLING_EMAIL", message: "Missing billing email." };
  }

  const paymentLink = resolveMonthlyInvoicePaymentLink(invoiceNumber);
  const dueDate = resolveMonthlyInvoiceDueDate(batch, billingAccount);

  const notificationOutboxId = await enqueueMonthlyInvoiceNotification(client, {
    customerId: batch.customerId,
    batchId: batch.id,
    template: MONTHLY_INVOICE_SENT_TEMPLATE,
    paymentUrl: paymentLink,
    invoiceNumber,
    billingMonth: batch.billingMonth,
    totalCents: batch.totalCents,
    currency: batch.currency,
    dueDate,
  });

  await recordBatchDeliveryQueued(client, batch, {
    outboxId: notificationOutboxId,
    kind: "invoice",
  }).catch(() => undefined);

  await recordCustomerBillingAccountAudit(client, {
    accountId: billingAccount.id,
    customerId: batch.customerId,
    adminProfileId: input.adminProfileId,
    action: "monthly_invoice_sent",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason ?? "Resend invoice",
    extra: { batchId: batch.id, resend: true, notificationOutboxId },
  }).catch(() => undefined);

  return { ok: true, notificationOutboxId };
}
