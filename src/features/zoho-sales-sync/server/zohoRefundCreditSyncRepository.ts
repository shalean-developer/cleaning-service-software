import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Json,
  ZohoRefundCreditSyncRow,
  ZohoRefundCreditSyncSourceType,
  ZohoRefundCreditSyncStatus,
} from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  computeNextRefundCreditSyncAttemptAt,
  shouldExhaustRefundCreditSyncAttempts,
} from "./zohoRefundCreditSyncRetryPolicy";

export type EnqueueZohoRefundCreditSyncInput = {
  sourceType: ZohoRefundCreditSyncSourceType;
  sourceId: string;
  bookingId?: string | null;
  invoiceNumber?: string | null;
  zohoInvoiceId?: string | null;
  paystackReference?: string | null;
  amountCents: number;
  currency?: string;
  reason: string;
  initiatedByAdminId?: string | null;
  metadata?: Json;
};

export async function findZohoRefundCreditSyncBySource(
  sourceType: ZohoRefundCreditSyncSourceType,
  sourceId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoRefundCreditSyncRow | null> {
  const { data, error } = await client
    .from("zoho_refund_credit_sync")
    .select("*")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function enqueueZohoRefundCreditSync(
  input: EnqueueZohoRefundCreditSyncInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoRefundCreditSyncRow> {
  const existing = await findZohoRefundCreditSyncBySource(
    input.sourceType,
    input.sourceId,
    client,
  );
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("zoho_refund_credit_sync")
    .insert({
      source_type: input.sourceType,
      source_id: input.sourceId,
      booking_id: input.bookingId ?? null,
      invoice_number: input.invoiceNumber ?? null,
      zoho_invoice_id: input.zohoInvoiceId ?? null,
      paystack_reference: input.paystackReference ?? null,
      amount_cents: input.amountCents,
      currency: input.currency ?? "ZAR",
      reason: input.reason,
      initiated_by_admin_id: input.initiatedByAdminId ?? null,
      metadata: input.metadata ?? {},
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const row = await findZohoRefundCreditSyncBySource(
        input.sourceType,
        input.sourceId,
        client,
      );
      if (row) return row;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function markZohoRefundCreditSynced(
  syncId: string,
  patch: {
    zohoCreditNoteId?: string | null;
    zohoRefundId?: string | null;
    zohoInvoiceId?: string | null;
    invoiceNumber?: string | null;
    metadata?: Json;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoRefundCreditSyncRow> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    sync_status: "synced",
    last_sync_error: null,
    next_sync_attempt_at: null,
    synced_at: now,
    updated_at: now,
  };

  if (patch.zohoCreditNoteId !== undefined) update.zoho_credit_note_id = patch.zohoCreditNoteId;
  if (patch.zohoRefundId !== undefined) update.zoho_refund_id = patch.zohoRefundId;
  if (patch.zohoInvoiceId !== undefined) update.zoho_invoice_id = patch.zohoInvoiceId;
  if (patch.invoiceNumber !== undefined) update.invoice_number = patch.invoiceNumber;
  if (patch.metadata !== undefined) update.metadata = patch.metadata;

  const { data, error } = await client
    .from("zoho_refund_credit_sync")
    .update(update)
    .eq("id", syncId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function markZohoRefundCreditFailed(
  syncId: string,
  safeError: string,
  attemptCountAfterFailure: number,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoRefundCreditSyncRow> {
  const now = new Date().toISOString();
  const exhausted = shouldExhaustRefundCreditSyncAttempts(attemptCountAfterFailure);
  const nextAttemptAt = exhausted
    ? null
    : computeNextRefundCreditSyncAttemptAt(attemptCountAfterFailure);

  const { data, error } = await client
    .from("zoho_refund_credit_sync")
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

export async function recordZohoRefundCreditSyncAttemptStart(
  syncId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from("zoho_refund_credit_sync")
    .update({
      last_sync_attempt_at: now,
      updated_at: now,
    })
    .eq("id", syncId);

  if (error) throw new Error(error.message);
}

export type ZohoRefundCreditSyncListFilters = {
  limit?: number;
};

export async function listZohoRefundCreditSyncPending(
  filters: ZohoRefundCreditSyncListFilters = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoRefundCreditSyncRow[]> {
  const limit = filters.limit ?? 25;
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("zoho_refund_credit_sync")
    .select("*")
    .eq("sync_status", "pending")
    .or(`next_sync_attempt_at.is.null,next_sync_attempt_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function countZohoRefundCreditDiagnostics(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<Record<ZohoRefundCreditSyncStatus, number>> {
  const counts: Record<ZohoRefundCreditSyncStatus, number> = {
    pending: 0,
    synced: 0,
    failed: 0,
  };

  for (const status of ["pending", "synced", "failed"] as const) {
    const { count, error } = await client
      .from("zoho_refund_credit_sync")
      .select("*", { count: "exact", head: true })
      .eq("sync_status", status);

    if (error) throw new Error(error.message);
    counts[status] = count ?? 0;
  }

  return counts;
}

export type ZohoRefundCreditDiagnosticsFilters = {
  status?: ZohoRefundCreditSyncStatus;
  invoiceNumber?: string;
  limit?: number;
};

export async function listZohoRefundCreditDiagnostics(
  filters: ZohoRefundCreditDiagnosticsFilters = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoRefundCreditSyncRow[]> {
  let query = client
    .from("zoho_refund_credit_sync")
    .select("*")
    .order("updated_at", { ascending: false });

  if (filters.status) {
    query = query.eq("sync_status", filters.status);
  }
  if (filters.invoiceNumber?.trim()) {
    query = query.eq("invoice_number", filters.invoiceNumber.trim());
  }

  const { data, error } = await query.limit(filters.limit ?? 50);
  if (error) throw new Error(error.message);
  return data ?? [];
}
