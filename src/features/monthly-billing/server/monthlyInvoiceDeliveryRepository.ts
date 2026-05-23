import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";
import { getMonthlyInvoiceBatch } from "./monthlyInvoiceBatchRepository";
import type { MonthlyInvoiceBatch } from "./monthlyBillingTypes";
import {
  buildMonthlyInvoiceDeliveryMetadata,
  type MonthlyInvoiceDeliveryChannelRecord,
  type MonthlyInvoiceDeliveryMetadata,
} from "./monthlyInvoiceDeliveryTypes";

export async function updateBatchDeliveryMetadata(
  client: SupabaseClient<Database>,
  batch: MonthlyInvoiceBatch,
  patch: Partial<MonthlyInvoiceDeliveryMetadata>,
): Promise<MonthlyInvoiceBatch> {
  const metadata = buildMonthlyInvoiceDeliveryMetadata(batch.metadata, patch);
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
  if (!data) throw new Error("Batch delivery metadata could not be updated.");

  return {
    id: data.id,
    customerId: data.customer_id,
    billingMonth: data.billing_month,
    status: data.status,
    zohoInvoiceId: data.zoho_invoice_id,
    zohoInvoiceNumber: data.zoho_invoice_number,
    totalCents: data.total_cents,
    currency: data.currency,
    generatedByAdminId: data.generated_by_admin_id,
    generatedAt: data.generated_at,
    sentAt: data.sent_at,
    paidAt: data.paid_at,
    idempotencyKey: data.idempotency_key,
    zohoReferenceNumber: data.zoho_reference_number,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function recordBatchDeliveryQueued(
  client: SupabaseClient<Database>,
  batch: MonthlyInvoiceBatch,
  input: { outboxId: string; kind: "invoice" | "reminder" },
): Promise<MonthlyInvoiceBatch> {
  const delivery = batch.metadata;
  const { readMonthlyInvoiceDeliveryMetadata } = await import("./monthlyInvoiceDeliveryTypes");
  const current = readMonthlyInvoiceDeliveryMetadata(delivery);
  const queuedAt = new Date().toISOString();
  const channelRecord: MonthlyInvoiceDeliveryChannelRecord = {
    channel: "email",
    outboxId: input.outboxId,
    queuedAt,
    status: "queued",
  };

  return updateBatchDeliveryMetadata(client, batch, {
    sentChannels: [...current.sentChannels, channelRecord].slice(-50),
    lastDeliveryStatus: "queued",
    lastSentAt: input.kind === "invoice" ? queuedAt : current.lastSentAt,
    lastReminderAt: input.kind === "reminder" ? queuedAt : current.lastReminderAt,
  });
}

export async function recordBatchDeliveryFailure(
  client: SupabaseClient<Database>,
  batch: MonthlyInvoiceBatch,
  input: { outboxId?: string; error: string },
): Promise<MonthlyInvoiceBatch> {
  const { readMonthlyInvoiceDeliveryMetadata } = await import("./monthlyInvoiceDeliveryTypes");
  const current = readMonthlyInvoiceDeliveryMetadata(batch.metadata);
  const sentChannels = current.sentChannels.map((row) =>
    row.outboxId === input.outboxId ? { ...row, status: "failed" as const } : row,
  );

  return updateBatchDeliveryMetadata(client, batch, {
    sentChannels,
    deliveryFailures: current.deliveryFailures + 1,
    lastDeliveryStatus: "failed",
  });
}

export async function initializeBatchDeliveryMetadata(
  client: SupabaseClient<Database>,
  batchId: string,
  autoSendEnabled: boolean,
): Promise<MonthlyInvoiceBatch | null> {
  const batch = await getMonthlyInvoiceBatch(batchId, client);
  if (!batch) return null;
  return updateBatchDeliveryMetadata(client, batch, { autoSendEnabled });
}
