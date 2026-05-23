import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Json,
  ZohoSalesSyncRow,
  ZohoSalesSyncSourceType,
  ZohoSalesSyncStatus,
} from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  computeNextSalesSyncAttemptAt,
  shouldExhaustSalesSyncAttempts,
} from "./zohoSalesSyncRetryPolicy";

export type EnqueueZohoSalesSyncInput = {
  sourceType: ZohoSalesSyncSourceType;
  sourceId: string;
  bookingId?: string | null;
  invoiceNumber?: string | null;
  zohoInvoiceId?: string | null;
  zohoCustomerId?: string | null;
  zohoPaymentId?: string | null;
  amountCents: number;
  currency?: string;
  syncStatus?: ZohoSalesSyncStatus;
  metadata?: Json;
  syncedAt?: string | null;
};

export async function findZohoSalesSyncBySource(
  sourceType: ZohoSalesSyncSourceType,
  sourceId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoSalesSyncRow | null> {
  const { data, error } = await client
    .from("zoho_sales_sync")
    .select("*")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function enqueueZohoSalesSync(
  input: EnqueueZohoSalesSyncInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoSalesSyncRow> {
  const existing = await findZohoSalesSyncBySource(input.sourceType, input.sourceId, client);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("zoho_sales_sync")
    .insert({
      source_type: input.sourceType,
      source_id: input.sourceId,
      booking_id: input.bookingId ?? null,
      invoice_number: input.invoiceNumber ?? null,
      zoho_invoice_id: input.zohoInvoiceId ?? null,
      zoho_customer_id: input.zohoCustomerId ?? null,
      zoho_payment_id: input.zohoPaymentId ?? null,
      amount_cents: input.amountCents,
      currency: input.currency ?? "ZAR",
      sync_status: input.syncStatus ?? "pending",
      metadata: input.metadata ?? {},
      synced_at: input.syncedAt ?? null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const row = await findZohoSalesSyncBySource(input.sourceType, input.sourceId, client);
      if (row) return row;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function markZohoSalesSyncSynced(
  syncId: string,
  patch: {
    zohoInvoiceId?: string | null;
    zohoCustomerId?: string | null;
    zohoPaymentId?: string | null;
    invoiceNumber?: string | null;
    metadata?: Json;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoSalesSyncRow> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    sync_status: "synced",
    last_sync_error: null,
    next_sync_attempt_at: null,
    synced_at: now,
    updated_at: now,
  };

  if (patch.zohoInvoiceId !== undefined) update.zoho_invoice_id = patch.zohoInvoiceId;
  if (patch.zohoCustomerId !== undefined) update.zoho_customer_id = patch.zohoCustomerId;
  if (patch.zohoPaymentId !== undefined) update.zoho_payment_id = patch.zohoPaymentId;
  if (patch.invoiceNumber !== undefined) update.invoice_number = patch.invoiceNumber;
  if (patch.metadata !== undefined) update.metadata = patch.metadata;

  const { data, error } = await client
    .from("zoho_sales_sync")
    .update(update)
    .eq("id", syncId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function markZohoSalesSyncFailed(
  syncId: string,
  safeError: string,
  attemptCountAfterFailure: number,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoSalesSyncRow> {
  const now = new Date().toISOString();
  const exhausted = shouldExhaustSalesSyncAttempts(attemptCountAfterFailure);
  const nextAttemptAt = exhausted
    ? null
    : computeNextSalesSyncAttemptAt(attemptCountAfterFailure);

  const { data, error } = await client
    .from("zoho_sales_sync")
    .update({
      sync_status: exhausted ? "failed" : "pending",
      sync_attempts: attemptCountAfterFailure,
      last_sync_attempt_at: now,
      next_sync_attempt_at: nextAttemptAt,
      last_sync_error: safeError.slice(0, 500),
      updated_at: now,
    })
    .eq("id", syncId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function recordZohoSalesSyncAttemptStart(
  syncId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from("zoho_sales_sync")
    .update({
      last_sync_attempt_at: now,
      updated_at: now,
    })
    .eq("id", syncId);

  if (error) throw new Error(error.message);
}

export type ZohoSalesSyncRetryFilters = {
  limit?: number;
};

export async function listRetryableZohoSalesSyncRows(
  filters: ZohoSalesSyncRetryFilters = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoSalesSyncRow[]> {
  const limit = filters.limit ?? 25;
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("zoho_sales_sync")
    .select("*")
    .eq("sync_status", "pending")
    .or(`next_sync_attempt_at.is.null,next_sync_attempt_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function countZohoSalesSyncByStatus(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<Record<ZohoSalesSyncStatus, number>> {
  const counts: Record<ZohoSalesSyncStatus, number> = {
    pending: 0,
    synced: 0,
    failed: 0,
  };

  for (const status of ["pending", "synced", "failed"] as const) {
    const { count, error } = await client
      .from("zoho_sales_sync")
      .select("*", { count: "exact", head: true })
      .eq("sync_status", status);

    if (error) throw new Error(error.message);
    counts[status] = count ?? 0;
  }

  return counts;
}

export async function listZohoSalesSyncDiagnostics(
  filters: { status?: ZohoSalesSyncStatus; limit?: number } = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoSalesSyncRow[]> {
  let query = client.from("zoho_sales_sync").select("*").order("updated_at", { ascending: false });

  if (filters.status) {
    query = query.eq("sync_status", filters.status);
  }

  const { data, error } = await query.limit(filters.limit ?? 50);
  if (error) throw new Error(error.message);
  return data ?? [];
}
