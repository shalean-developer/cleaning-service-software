import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";
import { resolveNotificationAppBaseUrl } from "@/lib/app/appBaseUrl";
import { buildZohoInvoicePaymentPageUrl } from "@/features/zoho-invoice-payments/server/buildZohoInvoicePaymentPageUrl";
import {
  resolveDueDateFromBillingTerms,
  resolveInvoiceDateJohannesburg,
} from "./buildZohoMonthlyInvoicePayload";
import type { CustomerBillingAccount, MonthlyInvoiceBatch } from "./monthlyBillingTypes";
import { readMonthlyInvoiceOperationsMetadata } from "./monthlyInvoiceOperationsTypes";
import {
  MONTHLY_INVOICE_REMINDER_TEMPLATE,
  MONTHLY_INVOICE_SENT_TEMPLATE,
} from "./monthlyInvoiceNotificationTemplate";

export function resolveMonthlyInvoicePaymentLink(
  invoiceNumber: string,
  appBaseUrl = resolveNotificationAppBaseUrl(),
): string {
  return buildZohoInvoicePaymentPageUrl(appBaseUrl, invoiceNumber);
}

export function resolveMonthlyInvoiceDueDate(
  batch: MonthlyInvoiceBatch,
  billingAccount: CustomerBillingAccount,
): string | null {
  const ops = readMonthlyInvoiceOperationsMetadata(batch.metadata);
  if (ops.dueDate) return ops.dueDate;

  const invoiceDate =
    batch.generatedAt?.slice(0, 10) ?? resolveInvoiceDateJohannesburg(batch.createdAt);
  return resolveDueDateFromBillingTerms(billingAccount.billingTerms, invoiceDate) ?? null;
}

export async function enqueueMonthlyInvoiceNotification(
  client: SupabaseClient<Database>,
  input: {
    customerId: string;
    batchId: string;
    template: typeof MONTHLY_INVOICE_SENT_TEMPLATE | typeof MONTHLY_INVOICE_REMINDER_TEMPLATE;
    paymentUrl: string;
    invoiceNumber: string;
    billingMonth: string;
    totalCents: number;
    currency: string;
    dueDate: string | null;
  },
): Promise<string> {
  const ts = new Date().toISOString();
  const payload: Json = {
    template: input.template,
    batchId: input.batchId,
    paymentUrl: input.paymentUrl,
    invoiceNumber: input.invoiceNumber,
    billingMonth: input.billingMonth,
    totalCents: input.totalCents,
    currency: input.currency,
    dueDate: input.dueDate,
  };

  const { data, error } = await client
    .from("notification_outbox")
    .insert({
      channel: "email",
      recipient: input.customerId,
      payload,
      status: "pending",
      attempts: 0,
      next_retry_at: null,
      last_error: null,
      created_at: ts,
      updated_at: ts,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data!.id;
}
