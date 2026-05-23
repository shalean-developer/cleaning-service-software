import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerBillingAccountAuditAction, Database } from "@/lib/database/types";
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
  markBatchSentFromGenerated,
  updateBatchOperationsMetadata,
} from "./monthlyInvoiceOperationsRepository";
import { recordBatchDeliveryQueued } from "./monthlyInvoiceDeliveryRepository";
import {
  isSendableBatchStatus,
  isTerminalInvoiceOperationsStatus,
  readMonthlyInvoiceOperationsMetadata,
} from "./monthlyInvoiceOperationsTypes";
import { MONTHLY_INVOICE_SENT_TEMPLATE } from "./monthlyInvoiceNotificationTemplate";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";

export type SendMonthlyInvoiceToCustomerInput = {
  batchId: string;
  adminProfileId: string | null;
  idempotencyKey: string;
  reason?: string;
  client?: SupabaseClient<Database>;
  source?: "manual" | "auto";
};

export type SendMonthlyInvoiceToCustomerSummary = {
  batchId: string;
  previousStatus: string;
  currentStatus: string;
  sentAt: string;
  paymentLink: string;
  notificationOutboxId: string;
};

export type SendMonthlyInvoiceToCustomerResult =
  | { ok: true; send: SendMonthlyInvoiceToCustomerSummary; idempotent: boolean }
  | { ok: false; code: string; message: string };

export class MonthlyInvoiceOperationsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MonthlyInvoiceOperationsError";
  }
}

export async function sendMonthlyInvoiceToCustomer(
  input: SendMonthlyInvoiceToCustomerInput,
): Promise<SendMonthlyInvoiceToCustomerResult> {
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

  const { batch, items } = loaded;

  if (isTerminalInvoiceOperationsStatus(batch.status)) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: `Cannot send invoice for batch in status ${batch.status}.`,
    };
  }

  if (batch.status === "sent" && batch.sentAt) {
    const ops = readMonthlyInvoiceOperationsMetadata(batch.metadata);
    const paymentLink =
      ops.paymentLink ??
      (batch.zohoInvoiceNumber ? resolveMonthlyInvoicePaymentLink(batch.zohoInvoiceNumber) : "");

    return {
      ok: true,
      idempotent: true,
      send: {
        batchId: batch.id,
        previousStatus: batch.status,
        currentStatus: batch.status,
        sentAt: batch.sentAt,
        paymentLink,
        notificationOutboxId: "",
      },
    };
  }

  if (!isSendableBatchStatus(batch.status)) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: `Invoice can only be sent when batch status is generated (current: ${batch.status}).`,
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

  const paymentLink = resolveMonthlyInvoicePaymentLink(invoiceNumber);
  const dueDate = resolveMonthlyInvoiceDueDate(batch, billingAccount);
  const sentAt = new Date().toISOString();

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

  const updated = await markBatchSentFromGenerated(client, batch.id, sentAt);
  await updateBatchOperationsMetadata(client, updated, {
    dueDate,
    paymentLink,
    lastSentAt: sentAt,
  });
  await recordBatchDeliveryQueued(client, updated, {
    outboxId: notificationOutboxId,
    kind: "invoice",
  }).catch(() => undefined);

  const auditAction: CustomerBillingAccountAuditAction =
    input.source === "auto" ? "monthly_invoice_auto_sent" : "monthly_invoice_sent";

  await recordCustomerBillingAccountAudit(client, {
    accountId: billingAccount.id,
    customerId: batch.customerId,
    adminProfileId: input.adminProfileId,
    action: auditAction,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason ?? null,
    before: { status: batch.status, sentAt: batch.sentAt },
    after: { status: updated.status, sentAt: updated.sentAt },
    extra: {
      batchId: batch.id,
      invoiceNumber,
      paymentLink,
      notificationOutboxId,
      itemCount: items.length,
      source: input.source ?? "manual",
    },
  }).catch(() => undefined);

  return {
    ok: true,
    idempotent: false,
    send: {
      batchId: batch.id,
      previousStatus: batch.status,
      currentStatus: updated.status,
      sentAt: updated.sentAt ?? sentAt,
      paymentLink,
      notificationOutboxId,
    },
  };
}
