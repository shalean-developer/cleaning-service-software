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
import {
  loadBatchForOperations,
  updateBatchOperationsMetadata,
} from "./monthlyInvoiceOperationsRepository";
import { recordBatchDeliveryQueued, updateBatchDeliveryMetadata } from "./monthlyInvoiceDeliveryRepository";
import {
  isReminderEligibleBatchStatus,
  isTerminalInvoiceOperationsStatus,
  readMonthlyInvoiceOperationsMetadata,
} from "./monthlyInvoiceOperationsTypes";
import { MONTHLY_INVOICE_REMINDER_TEMPLATE } from "./monthlyInvoiceNotificationTemplate";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";

export type SendMonthlyInvoiceReminderInput = {
  batchId: string;
  adminProfileId: string | null;
  idempotencyKey: string;
  reason?: string;
  client?: SupabaseClient<Database>;
};

export type SendMonthlyInvoiceReminderSummary = {
  batchId: string;
  status: string;
  reminderCount: number;
  lastReminderAt: string;
  paymentLink: string;
  notificationOutboxId: string;
};

export type SendMonthlyInvoiceReminderResult =
  | { ok: true; reminder: SendMonthlyInvoiceReminderSummary }
  | { ok: false; code: string; message: string };

export async function sendMonthlyInvoiceReminder(
  input: SendMonthlyInvoiceReminderInput,
): Promise<SendMonthlyInvoiceReminderResult> {
  if (!isZohoMonthlyInvoiceOperationsEnabled()) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "Monthly invoice operations are disabled (ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED).",
    };
  }

  const client = input.client ?? requireServiceRoleClient();
  const loaded = await loadBatchForOperations(input.batchId, client);
  if (!loaded) {
    return { ok: false, code: "BATCH_NOT_FOUND", message: "Monthly invoice batch not found." };
  }

  const { batch } = loaded;

  if (isTerminalInvoiceOperationsStatus(batch.status)) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: `Cannot send reminder for batch in status ${batch.status}.`,
    };
  }

  if (!isReminderEligibleBatchStatus(batch.status)) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: `Reminders are only allowed for sent or overdue batches (current: ${batch.status}).`,
    };
  }

  const invoiceNumber = batch.zohoInvoiceNumber?.trim();
  if (!invoiceNumber) {
    return {
      ok: false,
      code: "MISSING_INVOICE_NUMBER",
      message: "Batch has no Zoho invoice number.",
    };
  }

  const billingAccount = await getCustomerBillingAccount(batch.customerId, client);
  if (!billingAccount?.billingEmail?.trim()) {
    return {
      ok: false,
      code: "MISSING_BILLING_EMAIL",
      message: "Customer billing account has no billing email.",
    };
  }

  const ops = readMonthlyInvoiceOperationsMetadata(batch.metadata);
  const paymentLink = ops.paymentLink ?? resolveMonthlyInvoicePaymentLink(invoiceNumber);
  const dueDate = resolveMonthlyInvoiceDueDate(batch, billingAccount);
  const lastReminderAt = new Date().toISOString();
  const reminderCount = ops.reminderCount + 1;

  const notificationOutboxId = await enqueueMonthlyInvoiceNotification(client, {
    customerId: batch.customerId,
    batchId: batch.id,
    template: MONTHLY_INVOICE_REMINDER_TEMPLATE,
    paymentUrl: paymentLink,
    invoiceNumber,
    billingMonth: batch.billingMonth,
    totalCents: batch.totalCents,
    currency: batch.currency,
    dueDate,
  });

  await updateBatchOperationsMetadata(client, batch, {
    paymentLink,
    dueDate,
    reminderCount,
    lastReminderAt,
  });
  await recordBatchDeliveryQueued(client, batch, {
    outboxId: notificationOutboxId,
    kind: "reminder",
  }).catch(() => undefined);
  await updateBatchDeliveryMetadata(client, batch, {
    reminderCount,
    lastReminderAt,
    collectionsState: batch.status === "overdue" ? "overdue" : "reminder_due",
  }).catch(() => undefined);

  await recordCustomerBillingAccountAudit(client, {
    accountId: billingAccount.id,
    customerId: batch.customerId,
    adminProfileId: input.adminProfileId,
    action: "monthly_invoice_reminder_sent",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason ?? null,
    before: { reminderCount: ops.reminderCount, lastReminderAt: ops.lastReminderAt },
    after: { reminderCount, lastReminderAt },
    extra: {
      batchId: batch.id,
      invoiceNumber,
      paymentLink,
      notificationOutboxId,
    },
  }).catch(() => undefined);

  return {
    ok: true,
    reminder: {
      batchId: batch.id,
      status: batch.status,
      reminderCount,
      lastReminderAt,
      paymentLink,
      notificationOutboxId,
    },
  };
}
