import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, MonthlyInvoiceBatchStatus } from "@/lib/database/types";
import {
  getMonthlyInvoiceBatch,
  listMonthlyInvoiceBatchItems,
} from "./monthlyInvoiceBatchRepository";
import type { MonthlyInvoiceBatch, MonthlyInvoiceBatchItem } from "./monthlyBillingTypes";
import {
  buildMonthlyInvoiceOperationsMetadata,
  type MonthlyInvoiceOperationsMetadata,
} from "./monthlyInvoiceOperationsTypes";

export type BatchForOperations = {
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

export async function loadBatchForOperations(
  batchId: string,
  client: SupabaseClient<Database>,
): Promise<BatchForOperations | null> {
  const batch = await getMonthlyInvoiceBatch(batchId, client);
  if (!batch) return null;
  const items = await listMonthlyInvoiceBatchItems(batchId, client);
  return { batch, items };
}

export async function markBatchSentFromGenerated(
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
    .eq("status", "generated")
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Batch could not be marked sent.");
  return mapBatchRow(data);
}

export async function updateBatchOperationsMetadata(
  client: SupabaseClient<Database>,
  batch: MonthlyInvoiceBatch,
  patch: Partial<MonthlyInvoiceOperationsMetadata>,
): Promise<MonthlyInvoiceBatch> {
  const metadata = buildMonthlyInvoiceOperationsMetadata(batch.metadata, patch);
  const { data, error } = await client
    .from("monthly_invoice_batches")
    .update({
      metadata: metadata as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batch.id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Batch metadata could not be updated.");
  return mapBatchRow(data);
}

export async function listBatchesEligibleForOverdueMarking(
  limit: number,
  client: SupabaseClient<Database>,
): Promise<MonthlyInvoiceBatch[]> {
  const { data, error } = await client
    .from("monthly_invoice_batches")
    .select("*")
    .in("status", ["generated", "sent"])
    .not("zoho_invoice_number", "is", null)
    .order("updated_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 200)));

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapBatchRow(row));
}

export async function markBatchOverdueForOperations(
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
    .in("status", ["generated", "sent"])
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    const existing = await getMonthlyInvoiceBatch(batchId, client);
    if (existing?.status === "overdue") return existing;
    throw new Error("Batch could not be marked overdue.");
  }
  return mapBatchRow(data);
}
