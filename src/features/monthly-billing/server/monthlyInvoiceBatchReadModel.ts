import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { resolveCustomerEmailOrNull } from "@/features/notifications/server/resolveCustomerEmailOrNull";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  countMonthlyInvoiceBatchItems,
  getMonthlyInvoiceBatch,
  listMonthlyInvoiceBatchItems,
  listMonthlyInvoiceBatches,
} from "./monthlyInvoiceBatchRepository";
import type { MonthlyInvoiceBatch, MonthlyInvoiceBatchItem } from "./monthlyBillingTypes";
import { readBatchPaymentSyncMetadata } from "./monthlyInvoicePaymentSyncTypes";

export type MonthlyInvoiceBatchItemSummary = {
  id: string;
  bookingId: string;
  visitDate: string;
  serviceSlug: string;
  amountCents: number;
  status: string;
};

export type MonthlyInvoiceBatchReadModel = {
  batchId: string;
  customerId: string;
  customerName: string | null;
  customerEmail: string | null;
  billingMonth: string;
  status: string;
  totalCents: number;
  currency: string;
  itemCount: number;
  zohoInvoiceId: string | null;
  zohoInvoiceNumber: string | null;
  generatedAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  items: MonthlyInvoiceBatchItemSummary[];
  invoiceReadinessLabel: string;
};

function invoiceReadinessLabel(
  batch: MonthlyInvoiceBatch,
  itemCount: number,
): string {
  if (batch.status === "void") return "Void";
  if (batch.status === "paid") return "Paid";
  if (batch.status === "overdue") return "Overdue — follow up";
  if (batch.status === "sent") return "Sent — awaiting payment";
  if (batch.status === "generated") return "Generated — awaiting payment sync";
  if (itemCount === 0) return "Draft — no line items yet";
  if (batch.status === "draft" && itemCount > 0) {
    return "Draft — ready for invoice generation";
  }
  return "Draft — ready for generation (Phase 2)";
}

function mapItemSummary(item: MonthlyInvoiceBatchItem): MonthlyInvoiceBatchItemSummary {
  return {
    id: item.id,
    bookingId: item.bookingId,
    visitDate: item.visitDate,
    serviceSlug: item.serviceSlug,
    amountCents: item.amountCents,
    status: item.status,
  };
}

async function loadCustomerContact(
  customerId: string,
  client: SupabaseClient<Database>,
): Promise<{ name: string | null; email: string | null }> {
  const { data: customer, error } = await client
    .from("customers")
    .select("id, profile_id, company_name")
    .eq("id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!customer) return { name: null, email: null };

  let profileName: string | null = null;
  if (customer.profile_id) {
    const { data: profile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", customer.profile_id)
      .maybeSingle();
    profileName = profile?.full_name ?? null;
  }

  const email = await resolveCustomerEmailOrNull(customerId);

  return {
    name: customer.company_name?.trim() || profileName,
    email,
  };
}

export async function loadMonthlyInvoiceBatchReadModel(
  batchId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyInvoiceBatchReadModel | null> {
  const batch = await getMonthlyInvoiceBatch(batchId, client);
  if (!batch) return null;

  const [items, contact] = await Promise.all([
    listMonthlyInvoiceBatchItems(batchId, client),
    loadCustomerContact(batch.customerId, client),
  ]);

  return {
    batchId: batch.id,
    customerId: batch.customerId,
    customerName: contact.name,
    customerEmail: contact.email,
    billingMonth: batch.billingMonth,
    status: batch.status,
    totalCents: batch.totalCents,
    currency: batch.currency,
    itemCount: items.length,
    zohoInvoiceId: batch.zohoInvoiceId,
    zohoInvoiceNumber: batch.zohoInvoiceNumber,
    generatedAt: batch.generatedAt,
    sentAt: batch.sentAt,
    paidAt: batch.paidAt,
    items: items.map(mapItemSummary),
    invoiceReadinessLabel: invoiceReadinessLabel(batch, items.length),
  };
}

export type MonthlyInvoiceBatchListItem = Omit<
  MonthlyInvoiceBatchReadModel,
  "items" | "invoiceReadinessLabel"
> & {
  invoiceReadinessLabel: string;
  metadata: Record<string, unknown>;
  paidItemCount: number;
  paymentSyncLastCheckedAt: string | null;
  paymentSyncLastSource: string | null;
  paymentSyncLastError: string | null;
};

export async function loadMonthlyInvoiceBatchList(
  filters: Parameters<typeof listMonthlyInvoiceBatches>[0] = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyInvoiceBatchListItem[]> {
  const batches = await listMonthlyInvoiceBatches(filters, client);
  const results: MonthlyInvoiceBatchListItem[] = [];

  for (const batch of batches) {
    const [itemCount, paidItemCount, contact] = await Promise.all([
      countMonthlyInvoiceBatchItems(batch.id, client),
      client
        .from("monthly_invoice_batch_items")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batch.id)
        .eq("status", "paid")
        .then(({ count, error }) => {
          if (error) throw new Error(error.message);
          return count ?? 0;
        }),
      loadCustomerContact(batch.customerId, client),
    ]);

    const paymentSync = readBatchPaymentSyncMetadata(batch.metadata);

    results.push({
      batchId: batch.id,
      customerId: batch.customerId,
      customerName: contact.name,
      customerEmail: contact.email,
      billingMonth: batch.billingMonth,
      status: batch.status,
      totalCents: batch.totalCents,
      currency: batch.currency,
      itemCount,
      paidItemCount,
      zohoInvoiceId: batch.zohoInvoiceId,
      zohoInvoiceNumber: batch.zohoInvoiceNumber,
      generatedAt: batch.generatedAt,
      sentAt: batch.sentAt,
      paidAt: batch.paidAt,
      metadata: batch.metadata,
      paymentSyncLastCheckedAt: paymentSync.lastCheckedAt,
      paymentSyncLastSource: paymentSync.lastSource,
      paymentSyncLastError: paymentSync.lastError,
      invoiceReadinessLabel: invoiceReadinessLabel(batch, itemCount),
    });
  }

  return results;
}
