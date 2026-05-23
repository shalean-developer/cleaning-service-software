import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  MonthlyInvoiceBatchItemRow,
  MonthlyInvoiceBatchRow,
  MonthlyInvoiceBatchStatus,
} from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { MonthlyInvoiceBatch, MonthlyInvoiceBatchItem } from "./monthlyBillingTypes";

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

export type ListMonthlyInvoiceBatchesFilters = {
  customerId?: string;
  status?: MonthlyInvoiceBatchStatus;
  billingMonth?: string;
  limit?: number;
};

function mapBatchRow(row: MonthlyInvoiceBatchRow): MonthlyInvoiceBatch {
  return {
    id: row.id,
    customerId: row.customer_id,
    billingMonth: row.billing_month,
    status: row.status,
    zohoInvoiceId: row.zoho_invoice_id,
    zohoInvoiceNumber: row.zoho_invoice_number,
    totalCents: row.total_cents,
    currency: row.currency,
    generatedByAdminId: row.generated_by_admin_id,
    generatedAt: row.generated_at,
    sentAt: row.sent_at,
    paidAt: row.paid_at,
    idempotencyKey: row.idempotency_key,
    zohoReferenceNumber: row.zoho_reference_number,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemRow(row: MonthlyInvoiceBatchItemRow): MonthlyInvoiceBatchItem {
  return {
    id: row.id,
    batchId: row.batch_id,
    bookingId: row.booking_id,
    visitDate: row.visit_date,
    serviceSlug: row.service_slug,
    amountCents: row.amount_cents,
    status: row.status,
    zohoLineItemId: row.zoho_line_item_id,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clampLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(1, Math.floor(limit)), MAX_LIST_LIMIT);
}

export async function listMonthlyInvoiceBatches(
  filters: ListMonthlyInvoiceBatchesFilters = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyInvoiceBatch[]> {
  const limit = clampLimit(filters.limit);
  let query = client
    .from("monthly_invoice_batches")
    .select("*")
    .order("billing_month", { ascending: false })
    .limit(limit);

  if (filters.customerId) {
    query = query.eq("customer_id", filters.customerId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.billingMonth) {
    query = query.eq("billing_month", filters.billingMonth);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapBatchRow(row as MonthlyInvoiceBatchRow));
}

export async function getMonthlyInvoiceBatch(
  batchId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyInvoiceBatch | null> {
  const { data, error } = await client
    .from("monthly_invoice_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapBatchRow(data as MonthlyInvoiceBatchRow) : null;
}

export async function listMonthlyInvoiceBatchItems(
  batchId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyInvoiceBatchItem[]> {
  const { data, error } = await client
    .from("monthly_invoice_batch_items")
    .select("*")
    .eq("batch_id", batchId)
    .order("visit_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapItemRow(row as MonthlyInvoiceBatchItemRow));
}

export async function getMonthlyInvoiceBatchForCustomerMonth(
  customerId: string,
  billingMonth: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyInvoiceBatch | null> {
  const { data, error } = await client
    .from("monthly_invoice_batches")
    .select("*")
    .eq("customer_id", customerId)
    .eq("billing_month", billingMonth)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapBatchRow(data as MonthlyInvoiceBatchRow) : null;
}

export async function countMonthlyInvoiceBatchItems(
  batchId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<number> {
  const { count, error } = await client
    .from("monthly_invoice_batch_items")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
