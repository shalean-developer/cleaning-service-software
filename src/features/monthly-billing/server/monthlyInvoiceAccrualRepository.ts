import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Json,
  MonthlyInvoiceBatchItemRow,
  MonthlyInvoiceBatchRow,
  MonthlyInvoiceBatchStatus,
} from "@/lib/database/types";
import { getMonthlyInvoiceBatchForCustomerMonth } from "./monthlyInvoiceBatchRepository";
import type { MonthlyInvoiceBatch } from "./monthlyBillingTypes";

const LOCKED_BATCH_STATUSES = new Set<MonthlyInvoiceBatchStatus>([
  "generated",
  "sent",
  "paid",
  "overdue",
  "void",
]);

export class MonthlyInvoiceBatchLockedError extends Error {
  constructor(
    public readonly batchId: string,
    public readonly status: MonthlyInvoiceBatchStatus,
  ) {
    super(`Batch ${batchId} is locked (status=${status}).`);
    this.name = "MonthlyInvoiceBatchLockedError";
  }
}

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

export async function getExistingBatchItemForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<MonthlyInvoiceBatchItemRow | null> {
  const { data, error } = await client
    .from("monthly_invoice_batch_items")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function findOrCreateMonthlyInvoiceBatch(
  client: SupabaseClient<Database>,
  input: {
    customerId: string;
    billingMonth: string;
    idempotencyKey: string;
  },
): Promise<{ batch: MonthlyInvoiceBatch; created: boolean }> {
  const existing = await getMonthlyInvoiceBatchForCustomerMonth(
    input.customerId,
    input.billingMonth,
    client,
  );
  if (existing) {
    if (LOCKED_BATCH_STATUSES.has(existing.status)) {
      throw new MonthlyInvoiceBatchLockedError(existing.id, existing.status);
    }
    return { batch: existing, created: false };
  }

  const { data, error } = await client
    .from("monthly_invoice_batches")
    .insert({
      customer_id: input.customerId,
      billing_month: input.billingMonth,
      status: "draft",
      total_cents: 0,
      currency: "ZAR",
      idempotency_key: input.idempotencyKey,
      metadata: { source: "monthly_invoice_accrual" } as Json,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const raced = await getMonthlyInvoiceBatchForCustomerMonth(
        input.customerId,
        input.billingMonth,
        client,
      );
      if (!raced) throw new Error(error.message);
      if (LOCKED_BATCH_STATUSES.has(raced.status)) {
        throw new MonthlyInvoiceBatchLockedError(raced.id, raced.status);
      }
      return { batch: raced, created: false };
    }
    throw new Error(error.message);
  }

  if (!data) throw new Error("Could not create monthly invoice batch.");
  return { batch: mapBatchRow(data), created: true };
}

export type InsertMonthlyInvoiceBatchItemInput = {
  batchId: string;
  bookingId: string;
  visitDate: string;
  serviceSlug: string;
  amountCents: number;
  metadata?: Record<string, unknown>;
};

export async function insertMonthlyInvoiceBatchItem(
  client: SupabaseClient<Database>,
  input: InsertMonthlyInvoiceBatchItemInput,
): Promise<MonthlyInvoiceBatchItemRow> {
  const { data, error } = await client
    .from("monthly_invoice_batch_items")
    .insert({
      batch_id: input.batchId,
      booking_id: input.bookingId,
      visit_date: input.visitDate,
      service_slug: input.serviceSlug,
      amount_cents: input.amountCents,
      status: "accrued",
      metadata: (input.metadata ?? { source: "monthly_invoice_accrual" }) as Json,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await getExistingBatchItemForBooking(client, input.bookingId);
      if (existing) return existing;
    }
    throw new Error(error.message);
  }

  if (!data) throw new Error("Could not insert monthly invoice batch item.");
  return data;
}

export async function updateMonthlyInvoiceBatchTotal(
  client: SupabaseClient<Database>,
  batchId: string,
): Promise<number> {
  const { data: items, error: itemsError } = await client
    .from("monthly_invoice_batch_items")
    .select("amount_cents")
    .eq("batch_id", batchId)
    .neq("status", "excluded")
    .neq("status", "void");

  if (itemsError) throw new Error(itemsError.message);

  const total = (items ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);

  const { error: updateError } = await client
    .from("monthly_invoice_batches")
    .update({ total_cents: total, updated_at: new Date().toISOString() })
    .eq("id", batchId);

  if (updateError) throw new Error(updateError.message);
  return total;
}

export function isLockedBatchStatus(status: MonthlyInvoiceBatchStatus): boolean {
  return LOCKED_BATCH_STATUSES.has(status);
}
