import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MonthlyInvoiceBatchStatus } from "@/lib/database/types";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import {
  getMonthlyInvoiceBatch,
  listMonthlyInvoiceBatchItems,
} from "./monthlyInvoiceBatchRepository";
import { isLockedBatchStatus } from "./monthlyInvoiceAccrualRepository";
import type { CustomerBillingAccount, MonthlyInvoiceBatch, MonthlyInvoiceBatchItem } from "./monthlyBillingTypes";

const GENERATABLE_ITEM_STATUSES = new Set(["accrued", "included"]);

export type BatchForGeneration = {
  batch: MonthlyInvoiceBatch;
  items: MonthlyInvoiceBatchItem[];
  billingAccount: CustomerBillingAccount;
};

export class MonthlyInvoiceBatchGenerationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MonthlyInvoiceBatchGenerationError";
  }
}

export async function loadBatchForGeneration(
  batchId: string,
  client: SupabaseClient<Database>,
): Promise<BatchForGeneration | null> {
  const batch = await getMonthlyInvoiceBatch(batchId, client);
  if (!batch) return null;

  const [items, billingAccount] = await Promise.all([
    listMonthlyInvoiceBatchItems(batchId, client),
    getCustomerBillingAccount(batch.customerId, client),
  ]);

  if (!billingAccount) return null;

  return { batch, items, billingAccount };
}

export function assertBatchReadyForGeneration(input: BatchForGeneration): void {
  const { batch, items, billingAccount } = input;

  if (batch.zohoInvoiceId) {
    throw new MonthlyInvoiceBatchGenerationError(
      "INVOICE_ALREADY_EXISTS",
      "Batch already has a Zoho invoice.",
    );
  }

  if (batch.status !== "draft") {
    throw new MonthlyInvoiceBatchGenerationError(
      "BATCH_NOT_DRAFT",
      `Batch status is "${batch.status}", expected draft.`,
    );
  }

  if (isLockedBatchStatus(batch.status)) {
    throw new MonthlyInvoiceBatchGenerationError("BATCH_LOCKED", "Batch is locked.");
  }

  const generatableItems = items.filter((item) => GENERATABLE_ITEM_STATUSES.has(item.status));
  if (generatableItems.length === 0) {
    throw new MonthlyInvoiceBatchGenerationError(
      "BATCH_EMPTY",
      "Batch has no accrued items to invoice.",
    );
  }

  if (batch.totalCents <= 0) {
    throw new MonthlyInvoiceBatchGenerationError(
      "BATCH_TOTAL_INVALID",
      "Batch total must be greater than zero.",
    );
  }

  if (!billingAccount.isMonthlyAccountEnabled) {
    throw new MonthlyInvoiceBatchGenerationError(
      "MONTHLY_ACCOUNT_DISABLED",
      "Customer monthly account billing is disabled.",
    );
  }

  if (!billingAccount.zohoCustomerId?.trim()) {
    throw new MonthlyInvoiceBatchGenerationError(
      "MISSING_ZOHO_CUSTOMER",
      "Customer billing account has no Zoho customer id.",
    );
  }

  const bookingIds = new Set<string>();
  for (const item of generatableItems) {
    if (bookingIds.has(item.bookingId)) {
      throw new MonthlyInvoiceBatchGenerationError(
        "DUPLICATE_BOOKING_ITEM",
        "Batch contains duplicate booking items.",
      );
    }
    bookingIds.add(item.bookingId);
    if (item.amountCents <= 0) {
      throw new MonthlyInvoiceBatchGenerationError(
        "INVALID_ITEM_AMOUNT",
        "Batch item amount must be positive.",
      );
    }
  }
}

export async function lockBatchForGeneration(
  batchId: string,
  client: SupabaseClient<Database>,
): Promise<MonthlyInvoiceBatch> {
  const loaded = await loadBatchForGeneration(batchId, client);
  if (!loaded) {
    throw new MonthlyInvoiceBatchGenerationError("BATCH_NOT_FOUND", "Batch not found.");
  }
  assertBatchReadyForGeneration(loaded);
  return loaded.batch;
}

export async function getExistingGeneratedInvoice(
  batchId: string,
  client: SupabaseClient<Database>,
): Promise<{
  batchId: string;
  zohoInvoiceId: string;
  zohoInvoiceNumber: string | null;
  status: MonthlyInvoiceBatchStatus;
  totalCents: number;
  itemCount: number;
} | null> {
  const loaded = await loadBatchForGeneration(batchId, client);
  if (!loaded?.batch.zohoInvoiceId) return null;

  const generatableItems = loaded.items.filter((item) =>
    GENERATABLE_ITEM_STATUSES.has(item.status) || item.status === "invoiced",
  );

  return {
    batchId: loaded.batch.id,
    zohoInvoiceId: loaded.batch.zohoInvoiceId,
    zohoInvoiceNumber: loaded.batch.zohoInvoiceNumber,
    status: loaded.batch.status,
    totalCents: loaded.batch.totalCents,
    itemCount: generatableItems.length,
  };
}

export async function markBatchGenerated(
  client: SupabaseClient<Database>,
  input: {
    batchId: string;
    adminProfileId: string;
    zohoInvoiceId: string;
    zohoInvoiceNumber: string | null;
    zohoReferenceNumber: string;
  },
): Promise<MonthlyInvoiceBatch> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("monthly_invoice_batches")
    .update({
      status: "generated",
      zoho_invoice_id: input.zohoInvoiceId,
      zoho_invoice_number: input.zohoInvoiceNumber,
      zoho_reference_number: input.zohoReferenceNumber,
      generated_by_admin_id: input.adminProfileId,
      generated_at: now,
      updated_at: now,
    })
    .eq("id", input.batchId)
    .eq("status", "draft")
    .is("zoho_invoice_id", null)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new MonthlyInvoiceBatchGenerationError(
      "BATCH_STATE_RACE",
      "Batch could not be marked generated (state changed).",
    );
  }

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

export async function updateBatchItemsInvoiced(
  client: SupabaseClient<Database>,
  updates: Array<{ itemId: string; zohoLineItemId: string | null }>,
): Promise<void> {
  const now = new Date().toISOString();
  for (const update of updates) {
    const { error } = await client
      .from("monthly_invoice_batch_items")
      .update({
        status: "invoiced",
        zoho_line_item_id: update.zohoLineItemId,
        updated_at: now,
      })
      .eq("id", update.itemId)
      .in("status", ["accrued", "included"]);

    if (error) throw new Error(error.message);
  }
}

export function filterGeneratableBatchItems(items: MonthlyInvoiceBatchItem[]): MonthlyInvoiceBatchItem[] {
  return items.filter((item) => GENERATABLE_ITEM_STATUSES.has(item.status));
}
