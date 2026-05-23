import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getNotificationDeliveryConfig } from "@/features/notifications/server/config";
import { resolveMonthlyInvoiceDueDate, resolveMonthlyInvoicePaymentLink } from "./enqueueMonthlyInvoiceNotification";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import {
  listMonthlyInvoiceBatchItems,
  listMonthlyInvoiceBatches,
} from "./monthlyInvoiceBatchRepository";
import {
  formatBillingMonthLabel,
  isDueDatePast,
  readMonthlyInvoiceOperationsMetadata,
} from "./monthlyInvoiceOperationsTypes";
import { buildMonthlyInvoiceVisitSummaries } from "./monthlyInvoiceNotificationTemplate";
import { computeInvoiceAgingBucket, daysBetweenDates } from "./monthlyInvoiceDeliveryTypes";

export type CustomerMonthlyInvoiceVisitSummary = {
  visitDate: string;
  serviceLabel: string;
  amountCents: number;
};

export type CustomerMonthlyInvoiceListItem = {
  batchId: string;
  billingMonth: string;
  billingMonthLabel: string;
  status: string;
  invoiceNumber: string | null;
  totalCents: number;
  currency: string;
  dueDate: string | null;
  paymentLink: string | null;
  paidAt: string | null;
  sentAt: string | null;
  visitCount: number;
  visitSummaries: CustomerMonthlyInvoiceVisitSummary[];
  agingBucket: string;
  daysUntilDue: number | null;
  daysOverdue: number | null;
  isOverdue: boolean;
  reminderNotice: string | null;
  paymentReceivedMessage: string | null;
  downloadUrl: string | null;
  financeSupportEmail: string | null;
};

export type CustomerMonthlyInvoicesResult = {
  invoices: CustomerMonthlyInvoiceListItem[];
  financeSupportEmail: string | null;
};

function buildCustomerReminderNotice(input: {
  status: string;
  dueDate: string | null;
  isOverdue: boolean;
  daysUntilDue: number | null;
  daysOverdue: number | null;
}): string | null {
  if (input.status === "paid") return null;
  if (input.isOverdue && input.daysOverdue != null) {
    return `This invoice is ${input.daysOverdue} day${input.daysOverdue === 1 ? "" : "s"} overdue. Please pay as soon as possible.`;
  }
  if (input.daysUntilDue != null && input.daysUntilDue >= 0 && input.daysUntilDue <= 3) {
    if (input.daysUntilDue === 0) return "Payment is due today.";
    return `Payment is due in ${input.daysUntilDue} day${input.daysUntilDue === 1 ? "" : "s"}.`;
  }
  return null;
}

export function buildCustomerPortalFields(input: {
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  paymentLink: string | null;
  invoiceNumber: string | null;
  financeSupportEmail: string | null;
  now?: Date;
}): Pick<
  CustomerMonthlyInvoiceListItem,
  | "agingBucket"
  | "daysUntilDue"
  | "daysOverdue"
  | "isOverdue"
  | "reminderNotice"
  | "paymentReceivedMessage"
  | "downloadUrl"
  | "financeSupportEmail"
> {
  const now = input.now ?? new Date();
  const todayIso = now.toISOString();
  const agingBucket = computeInvoiceAgingBucket(input.dueDate, now);
  const unpaid =
    input.status === "generated" || input.status === "sent" || input.status === "overdue";
  const isOverdue =
    input.status === "overdue" ||
    (unpaid && input.dueDate != null && isDueDatePast(input.dueDate, now));
  const daysUntilDue =
    unpaid && input.dueDate ? daysBetweenDates(todayIso, input.dueDate) : null;
  const daysOverdue =
    isOverdue && input.dueDate ? Math.max(0, daysBetweenDates(input.dueDate, todayIso)) : null;

  return {
    agingBucket,
    daysUntilDue: daysUntilDue != null && daysUntilDue >= 0 ? daysUntilDue : null,
    daysOverdue,
    isOverdue,
    reminderNotice: buildCustomerReminderNotice({
      status: input.status,
      dueDate: input.dueDate,
      isOverdue,
      daysUntilDue,
      daysOverdue,
    }),
    paymentReceivedMessage:
      input.status === "paid" && input.paidAt
        ? "Thank you — we received your payment for this invoice."
        : null,
    downloadUrl: input.paymentLink ?? (input.invoiceNumber ? resolveMonthlyInvoicePaymentLink(input.invoiceNumber) : null),
    financeSupportEmail: input.financeSupportEmail,
  };
}

async function resolveCustomerIdForUser(
  user: CurrentUser,
  client: SupabaseClient<Database>,
): Promise<string | null> {
  const scope = await resolveActorScope(client, user.profileId, user.role);
  return scope.actingCustomerId ?? null;
}

export async function loadCustomerMonthlyInvoices(
  customerId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CustomerMonthlyInvoicesResult> {
  const batches = await listMonthlyInvoiceBatches({ customerId, limit: 24 }, client);
  const billingAccount = await getCustomerBillingAccount(customerId, client);
  const financeSupportEmail = getNotificationDeliveryConfig().supportEmail;

  const visible = batches.filter(
    (batch) =>
      batch.status === "generated" ||
      batch.status === "sent" ||
      batch.status === "overdue" ||
      batch.status === "paid",
  );

  const invoices: CustomerMonthlyInvoiceListItem[] = [];

  for (const batch of visible) {
    const items = await listMonthlyInvoiceBatchItems(batch.id, client);
    const ops = readMonthlyInvoiceOperationsMetadata(batch.metadata);
    const dueDate =
      ops.dueDate ??
      (billingAccount ? resolveMonthlyInvoiceDueDate(batch, billingAccount) : null);
    const invoiceNumber = batch.zohoInvoiceNumber?.trim() || null;
    const unpaid = batch.status === "generated" || batch.status === "sent" || batch.status === "overdue";
    const paymentLink =
      unpaid && invoiceNumber
        ? ops.paymentLink ?? resolveMonthlyInvoicePaymentLink(invoiceNumber)
        : null;

    const visitSummaries = buildMonthlyInvoiceVisitSummaries(items).map((visit) => ({
      visitDate: visit.visitDate,
      serviceLabel: visit.serviceLabel,
      amountCents: visit.amountCents,
    }));

    const portalFields = buildCustomerPortalFields({
      status: batch.status,
      dueDate,
      paidAt: batch.paidAt,
      paymentLink,
      invoiceNumber,
      financeSupportEmail,
    });

    invoices.push({
      batchId: batch.id,
      billingMonth: batch.billingMonth,
      billingMonthLabel: formatBillingMonthLabel(batch.billingMonth),
      status: batch.status,
      invoiceNumber,
      totalCents: batch.totalCents,
      currency: batch.currency,
      dueDate,
      paymentLink,
      paidAt: batch.paidAt,
      sentAt: batch.sentAt,
      visitCount: items.length,
      visitSummaries,
      ...portalFields,
    });
  }

  return { invoices, financeSupportEmail };
}

export async function loadCustomerMonthlyInvoicesForUser(
  user: CurrentUser,
): Promise<CustomerMonthlyInvoicesResult> {
  const serverClient = await createSupabaseServerClient();
  if (!serverClient) {
    throw new Error("Supabase not configured.");
  }

  const customerId = await resolveCustomerIdForUser(user, serverClient);
  if (!customerId) {
    return { invoices: [], financeSupportEmail: getNotificationDeliveryConfig().supportEmail };
  }

  return loadCustomerMonthlyInvoices(customerId, requireServiceRoleClient());
}
