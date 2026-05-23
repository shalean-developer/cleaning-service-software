import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, ZohoInvoicePaymentRow, ZohoInvoicePaymentStatus } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { MAX_ZOHO_RECONCILE_ATTEMPTS } from "./zohoInvoiceReconcileRetryPolicy";

export type CreateZohoInvoicePaymentAttemptInput = {
  invoiceNumber: string;
  zohoInvoiceId: string;
  customerName: string | null;
  customerEmail: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

const ACTIVE_STATUSES: ZohoInvoicePaymentStatus[] = [
  "initialized",
  "pending_paystack",
  "zoho_reconcile_pending",
];

export async function createZohoInvoicePaymentAttempt(
  input: CreateZohoInvoicePaymentAttemptInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow> {
  const { data, error } = await client
    .from("zoho_invoice_payments")
    .insert({
      invoice_number: input.invoiceNumber,
      zoho_invoice_id: input.zohoInvoiceId,
      customer_name: input.customerName,
      customer_email: input.customerEmail.trim(),
      amount_cents: input.amountCents,
      currency: input.currency,
      status: "initialized",
      idempotency_key: input.idempotencyKey,
      metadata: (input.metadata ?? {}) as Json,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create zoho_invoice_payments row.");
  }

  return data;
}

export async function findActiveZohoInvoicePaymentByInvoiceNumber(
  invoiceNumber: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow | null> {
  const { data, error } = await client
    .from("zoho_invoice_payments")
    .select("*")
    .eq("invoice_number", invoiceNumber)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function findZohoInvoicePaymentByReference(
  reference: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow | null> {
  const { data, error } = await client
    .from("zoho_invoice_payments")
    .select("*")
    .eq("paystack_reference", reference.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateZohoInvoicePaymentPaystackInitialized(
  id: string,
  data: {
    paystackReference: string;
    paystackAccessCode: string;
    paystackAuthorizationUrl: string;
    paystackStatus: string;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow> {
  const now = new Date().toISOString();
  const { data: row, error } = await client
    .from("zoho_invoice_payments")
    .update({
      paystack_reference: data.paystackReference,
      paystack_access_code: data.paystackAccessCode,
      paystack_authorization_url: data.paystackAuthorizationUrl,
      paystack_status: data.paystackStatus,
      status: "pending_paystack",
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Failed to update zoho_invoice_payments Paystack fields.");
  }

  return row;
}

export async function mergeZohoInvoicePaymentMetadata(
  id: string,
  patch: Record<string, unknown>,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<void> {
  const existing = await findZohoInvoicePaymentById(id, client);
  if (!existing) {
    throw new Error("zoho_invoice_payments row not found.");
  }

  const current =
    existing.metadata != null &&
    typeof existing.metadata === "object" &&
    !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};

  const { error } = await client
    .from("zoho_invoice_payments")
    .update({
      metadata: { ...current, ...patch } as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function markZohoInvoicePaymentInitializeFailed(
  id: string,
  reason: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from("zoho_invoice_payments")
    .update({
      status: "failed",
      paystack_status: "initialize_failed",
      updated_at: now,
      metadata: {
        initialize_failure_reason: reason,
      } as Json,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function cancelActiveZohoInvoicePaymentAttempt(
  id: string,
  reason: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from("zoho_invoice_payments")
    .update({
      status: "cancelled",
      updated_at: now,
      metadata: {
        cancelled_reason: reason,
      } as Json,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export type InsertZohoInvoicePaymentEventInput = {
  zohoInvoicePaymentId: string;
  providerEventId: string;
  eventType: string;
  paystackReference: string;
  payload?: Record<string, unknown>;
};

export type InsertZohoInvoicePaymentEventResult =
  | { outcome: "inserted" }
  | { outcome: "duplicate" };

export async function insertZohoInvoicePaymentEvent(
  input: InsertZohoInvoicePaymentEventInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<InsertZohoInvoicePaymentEventResult> {
  const { error } = await client.from("zoho_invoice_payment_events").insert({
    zoho_invoice_payment_id: input.zohoInvoicePaymentId,
    provider_event_id: input.providerEventId,
    event_type: input.eventType,
    paystack_reference: input.paystackReference,
    payload: (input.payload ?? {}) as Json,
  });

  if (error?.code === "23505") {
    return { outcome: "duplicate" };
  }
  if (error) {
    throw new Error(error.message);
  }

  return { outcome: "inserted" };
}

export async function findZohoInvoicePaymentById(
  id: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow | null> {
  const { data, error } = await client
    .from("zoho_invoice_payments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

function mergeMetadata(
  existing: Json,
  patch: Record<string, unknown>,
): Json {
  const base =
    existing != null && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Json;
}

export async function markZohoInvoicePaymentPaid(
  input: {
    id: string;
    zohoPaymentId: string;
    zohoStatus?: string | null;
    paystackStatus?: string;
    reconciliationMetadata?: Record<string, unknown>;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow> {
  const existing = await findZohoInvoicePaymentById(input.id, client);
  if (!existing) {
    throw new Error("zoho_invoice_payments row not found.");
  }

  if (existing.status === "paid" && existing.zoho_payment_id) {
    return existing;
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("zoho_invoice_payments")
    .update({
      status: "paid",
      paid_at: existing.paid_at ?? now,
      paystack_status: input.paystackStatus ?? "success",
      zoho_payment_id: input.zohoPaymentId,
      zoho_status: input.zohoStatus ?? null,
      updated_at: now,
      metadata: mergeMetadata(existing.metadata, {
        ...(input.reconciliationMetadata ?? {}),
        reconciled_at: now,
      }),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to mark zoho_invoice_payments paid.");
  }

  return data;
}

export async function markZohoInvoicePaymentFailed(
  input: {
    id: string;
    paystackStatus?: string;
    reason?: string;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow> {
  const existing = await findZohoInvoicePaymentById(input.id, client);
  if (!existing) {
    throw new Error("zoho_invoice_payments row not found.");
  }

  if (existing.status === "paid") {
    return existing;
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("zoho_invoice_payments")
    .update({
      status: "failed",
      paystack_status: input.paystackStatus ?? "failed",
      updated_at: now,
      metadata: mergeMetadata(existing.metadata, {
        failure_reason: input.reason ?? "paystack_charge_failed",
      }),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to mark zoho_invoice_payments failed.");
  }

  return data;
}

export async function markZohoInvoicePaymentReconcilePending(
  input: {
    id: string;
    paystackStatus?: string;
    reason: string;
    reconciliationMetadata?: Record<string, unknown>;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow> {
  const existing = await findZohoInvoicePaymentById(input.id, client);
  if (!existing) {
    throw new Error("zoho_invoice_payments row not found.");
  }

  if (existing.status === "paid" && existing.zoho_payment_id) {
    return existing;
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("zoho_invoice_payments")
    .update({
      status: "zoho_reconcile_pending",
      paystack_status: input.paystackStatus ?? existing.paystack_status ?? "success",
      updated_at: now,
      metadata: mergeMetadata(existing.metadata, {
        reconcile_pending_reason: input.reason,
        ...(input.reconciliationMetadata ?? {}),
      }),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to mark zoho_invoice_payments reconcile pending.");
  }

  return data;
}

export async function markZohoInvoicePaymentReconcileFailed(
  input: {
    id: string;
    paystackStatus?: string;
    reason: string;
    reconciliationMetadata?: Record<string, unknown>;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow> {
  const existing = await findZohoInvoicePaymentById(input.id, client);
  if (!existing) {
    throw new Error("zoho_invoice_payments row not found.");
  }

  if (existing.status === "paid" && existing.zoho_payment_id) {
    return existing;
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("zoho_invoice_payments")
    .update({
      status: "zoho_reconcile_failed",
      paystack_status: input.paystackStatus ?? existing.paystack_status ?? "success",
      updated_at: now,
      metadata: mergeMetadata(existing.metadata, {
        reconcile_failed_reason: input.reason,
        ...(input.reconciliationMetadata ?? {}),
      }),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to mark zoho_invoice_payments reconcile failed.");
  }

  return data;
}

export type ZohoInvoicePaymentDiagnosticsFilters = {
  status?: ZohoInvoicePaymentStatus;
  invoiceNumber?: string;
  limit?: number;
};

const PROBLEMATIC_DIAGNOSTIC_STATUSES: ZohoInvoicePaymentStatus[] = [
  "pending_paystack",
  "failed",
  "zoho_reconcile_pending",
  "zoho_reconcile_failed",
];

const SUMMARY_STATUSES: ZohoInvoicePaymentStatus[] = [
  "pending_paystack",
  "paid",
  "failed",
  "zoho_reconcile_pending",
  "zoho_reconcile_failed",
];

export async function listZohoInvoicePaymentsPendingReconciliation(
  limit = 25,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow[]> {
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("zoho_invoice_payments")
    .select("*")
    .eq("status", "zoho_reconcile_pending")
    .lt("reconcile_attempts", MAX_ZOHO_RECONCILE_ATTEMPTS)
    .or(`next_reconcile_attempt_at.is.null,next_reconcile_attempt_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function countZohoInvoicePaymentDiagnostics(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<Record<ZohoInvoicePaymentStatus, number>> {
  const counts = Object.fromEntries(
    SUMMARY_STATUSES.map((status) => [status, 0]),
  ) as Record<ZohoInvoicePaymentStatus, number>;

  await Promise.all(
    SUMMARY_STATUSES.map(async (status) => {
      const { count, error } = await client
        .from("zoho_invoice_payments")
        .select("id", { count: "exact", head: true })
        .eq("status", status);

      if (error) throw new Error(error.message);
      counts[status] = count ?? 0;
    }),
  );

  return counts;
}

export async function listZohoInvoicePaymentDiagnostics(
  filters: ZohoInvoicePaymentDiagnosticsFilters = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow[]> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);

  let query = client
    .from("zoho_invoice_payments")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    query = query.in("status", PROBLEMATIC_DIAGNOSTIC_STATUSES);
  }

  if (filters.invoiceNumber?.trim()) {
    query = query.eq("invoice_number", filters.invoiceNumber.trim());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function markZohoInvoicePaymentRetrying(
  id: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from("zoho_invoice_payments")
    .update({
      last_reconcile_attempt_at: now,
      updated_at: now,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function incrementZohoInvoicePaymentReconcileAttempt(
  input: {
    id: string;
    safeError: string;
    nextAttemptAt: string | null;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow> {
  const existing = await findZohoInvoicePaymentById(input.id, client);
  if (!existing) {
    throw new Error("zoho_invoice_payments row not found.");
  }

  const now = new Date().toISOString();
  const nextAttempts = (existing.reconcile_attempts ?? 0) + 1;

  const { data, error } = await client
    .from("zoho_invoice_payments")
    .update({
      reconcile_attempts: nextAttempts,
      last_reconcile_attempt_at: now,
      next_reconcile_attempt_at: input.nextAttemptAt,
      last_reconcile_error: input.safeError,
      status: "zoho_reconcile_pending",
      updated_at: now,
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to increment reconcile attempts.");
  }

  return data;
}

export async function markZohoInvoicePaymentReconcileExhausted(
  id: string,
  reason: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentRow> {
  const existing = await findZohoInvoicePaymentById(id, client);
  if (!existing) {
    throw new Error("zoho_invoice_payments row not found.");
  }

  if (existing.status === "paid" && existing.zoho_payment_id) {
    return existing;
  }

  const now = new Date().toISOString();
  const nextAttempts = (existing.reconcile_attempts ?? 0) + 1;

  const { data, error } = await client
    .from("zoho_invoice_payments")
    .update({
      status: "zoho_reconcile_failed",
      reconcile_attempts: nextAttempts,
      last_reconcile_attempt_at: now,
      next_reconcile_attempt_at: null,
      last_reconcile_error: reason,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to mark reconcile exhausted.");
  }

  return data;
}
