import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, MonthlyInvoiceBatchStatus } from "@/lib/database/types";
import { getMonthlyInvoiceBatch, listMonthlyInvoiceBatchItems } from "./monthlyInvoiceBatchRepository";
import type { MonthlyInvoiceBatch, MonthlyInvoiceBatchItem } from "./monthlyBillingTypes";
import {
  buildBatchPaymentSyncMetadata,
  isSyncableBatchPaymentStatus,
  isTerminalBatchPaymentStatus,
  type BatchPaymentSyncMetadata,
  type MonthlyInvoicePaymentSyncSource,
  readBatchPaymentSyncMetadata,
} from "./monthlyInvoicePaymentSyncTypes";

export type BatchForPaymentSync = {
  batch: MonthlyInvoiceBatch;
  items: MonthlyInvoiceBatchItem[];
};

function mapBatchRow(row: {
  id: string;
  customer_id: string;
  billing_month: string;
  status: MonthlyInvoiceBatchStatus;
  zoho_invoice_id: string | null;
  zoho_invoice_number: string | null;
  total_cents: number;
  currency: string;
  generated_by_admin_id: string | null;
  generated_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  idempotency_key: string | null;
  zoho_reference_number: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}): MonthlyInvoiceBatch {
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

export async function loadBatchForPaymentSync(
  batchId: string,
  client: SupabaseClient<Database>,
): Promise<BatchForPaymentSync | null> {
  const batch = await getMonthlyInvoiceBatch(batchId, client);
  if (!batch) return null;
  const items = await listMonthlyInvoiceBatchItems(batchId, client);
  return { batch, items };
}

export async function findBatchByZohoInvoiceNumber(
  invoiceNumber: string,
  client: SupabaseClient<Database>,
): Promise<MonthlyInvoiceBatch | null> {
  const normalized = invoiceNumber.trim();
  if (!normalized) return null;

  const { data, error } = await client
    .from("monthly_invoice_batches")
    .select("*")
    .eq("zoho_invoice_number", normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapBatchRow(data) : null;
}

export async function findBatchByZohoInvoiceId(
  zohoInvoiceId: string,
  client: SupabaseClient<Database>,
): Promise<MonthlyInvoiceBatch | null> {
  const normalized = zohoInvoiceId.trim();
  if (!normalized) return null;

  const { data, error } = await client
    .from("monthly_invoice_batches")
    .select("*")
    .eq("zoho_invoice_id", normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapBatchRow(data) : null;
}

export async function loadGeneratedOrSentBatchesForSync(
  limit: number,
  client: SupabaseClient<Database>,
): Promise<MonthlyInvoiceBatch[]> {
  const { data, error } = await client
    .from("monthly_invoice_batches")
    .select("*")
    .in("status", ["generated", "sent", "overdue"])
    .not("zoho_invoice_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 200)));

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapBatchRow(row));
}

async function updateBatchPaymentSyncMetadata(
  client: SupabaseClient<Database>,
  batchId: string,
  existingMetadata: Record<string, unknown>,
  syncMeta: BatchPaymentSyncMetadata,
): Promise<void> {
  const { error } = await client
    .from("monthly_invoice_batches")
    .update({
      metadata: buildBatchPaymentSyncMetadata(existingMetadata, syncMeta) as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  if (error) throw new Error(error.message);
}

export async function recordBatchPaymentSyncCheck(
  client: SupabaseClient<Database>,
  batch: MonthlyInvoiceBatch,
  input: {
    source: MonthlyInvoicePaymentSyncSource;
    result: string;
    error?: string | null;
  },
): Promise<MonthlyInvoiceBatch> {
  const syncMeta: BatchPaymentSyncMetadata = {
    lastCheckedAt: new Date().toISOString(),
    lastSource: input.source,
    lastError: input.error ?? null,
    lastResult: input.result,
  };
  await updateBatchPaymentSyncMetadata(client, batch.id, batch.metadata, syncMeta);
  return {
    ...batch,
    metadata: buildBatchPaymentSyncMetadata(batch.metadata, syncMeta),
  };
}

export async function markBatchPaymentSyncFailed(
  client: SupabaseClient<Database>,
  batch: MonthlyInvoiceBatch,
  input: {
    source: MonthlyInvoicePaymentSyncSource;
    error: string;
  },
): Promise<MonthlyInvoiceBatch> {
  return recordBatchPaymentSyncCheck(client, batch, {
    source: input.source,
    result: batch.status,
    error: input.error,
  });
}

export async function markBatchSent(
  client: SupabaseClient<Database>,
  batchId: string,
  sentAt = new Date().toISOString(),
): Promise<MonthlyInvoiceBatch> {
  const existing = await getMonthlyInvoiceBatch(batchId, client);
  if (existing?.status === "sent" && existing.sentAt) {
    return existing;
  }

  const { data, error } = await client
    .from("monthly_invoice_batches")
    .update({
      status: "sent",
      sent_at: sentAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .in("status", ["generated", "sent", "overdue"])
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Batch could not be marked sent.");
  return mapBatchRow(data);
}

export async function markBatchOverdue(
  client: SupabaseClient<Database>,
  batchId: string,
): Promise<MonthlyInvoiceBatch> {
  const { data, error } = await client
    .from("monthly_invoice_batches")
    .update({
      status: "overdue",
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .in("status", ["generated", "sent", "overdue"])
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Batch could not be marked overdue.");
  return mapBatchRow(data);
}

export async function markBatchPaid(
  client: SupabaseClient<Database>,
  batchId: string,
  paidAt = new Date().toISOString(),
): Promise<MonthlyInvoiceBatch> {
  const { data, error } = await client
    .from("monthly_invoice_batches")
    .update({
      status: "paid",
      paid_at: paidAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .in("status", ["generated", "sent", "overdue"])
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    const existing = await getMonthlyInvoiceBatch(batchId, client);
    if (existing?.status === "paid") return existing;
    throw new Error("Batch could not be marked paid.");
  }
  return mapBatchRow(data);
}

export async function markBatchVoid(
  client: SupabaseClient<Database>,
  batchId: string,
): Promise<MonthlyInvoiceBatch> {
  const { data, error } = await client
    .from("monthly_invoice_batches")
    .update({
      status: "void",
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .in("status", ["generated", "sent", "overdue"])
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Batch could not be marked void.");
  return mapBatchRow(data);
}

export async function markItemsPaid(
  client: SupabaseClient<Database>,
  batchId: string,
): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("monthly_invoice_batch_items")
    .update({ status: "paid", updated_at: now })
    .eq("batch_id", batchId)
    .in("status", ["accrued", "included", "invoiced"])
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function findPaidShaleanZohoInvoicePayment(
  client: SupabaseClient<Database>,
  input: { zohoInvoiceId?: string | null; invoiceNumber?: string | null },
): Promise<{ id: string; paid_at: string | null; invoice_number: string; zoho_invoice_id: string } | null> {
  if (input.zohoInvoiceId?.trim()) {
    const { data, error } = await client
      .from("zoho_invoice_payments")
      .select("id, paid_at, invoice_number, zoho_invoice_id")
      .eq("zoho_invoice_id", input.zohoInvoiceId.trim())
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  if (input.invoiceNumber?.trim()) {
    const { data, error } = await client
      .from("zoho_invoice_payments")
      .select("id, paid_at, invoice_number, zoho_invoice_id")
      .eq("invoice_number", input.invoiceNumber.trim())
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  return null;
}

export {
  isSyncableBatchPaymentStatus,
  isTerminalBatchPaymentStatus,
  readBatchPaymentSyncMetadata,
};
