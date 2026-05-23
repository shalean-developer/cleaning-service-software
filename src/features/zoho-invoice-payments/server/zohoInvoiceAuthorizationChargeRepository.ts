import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Json,
  ZohoInvoiceAuthorizationChargeRow,
  ZohoInvoiceAuthorizationChargeStatus,
} from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { MAX_ZOHO_RECONCILE_ATTEMPTS } from "./zohoInvoiceReconcileRetryPolicy";

const ACTIVE_CHARGE_STATUSES: ZohoInvoiceAuthorizationChargeStatus[] = [
  "initialized",
  "submitted",
  "pending_webhook",
  "zoho_reconcile_pending",
];

export type CreateAuthorizationChargeAttemptInput = {
  invoiceNumber: string;
  zohoInvoiceId: string;
  paymentMethodId: string;
  customerEmail: string;
  amountCents: number;
  currency: string;
  paystackReference: string;
  initiatedByAdminId: string;
  reason: string;
  metadata?: Record<string, unknown>;
};

export async function createAuthorizationChargeAttempt(
  input: CreateAuthorizationChargeAttemptInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow> {
  const { data, error } = await client
    .from("zoho_invoice_authorization_charges")
    .insert({
      invoice_number: input.invoiceNumber,
      zoho_invoice_id: input.zohoInvoiceId,
      payment_method_id: input.paymentMethodId,
      customer_email: input.customerEmail.trim().toLowerCase(),
      amount_cents: input.amountCents,
      currency: input.currency,
      paystack_reference: input.paystackReference,
      status: "initialized",
      initiated_by_admin_id: input.initiatedByAdminId,
      reason: input.reason.trim(),
      metadata: (input.metadata ?? {}) as Json,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create authorization charge attempt.");
  }

  return data;
}

export async function updateAuthorizationChargeReference(
  id: string,
  paystackReference: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow> {
  const { data, error } = await client
    .from("zoho_invoice_authorization_charges")
    .update({ paystack_reference: paystackReference.trim() })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update authorization charge reference.");
  }

  return data;
}

export async function findActiveAuthorizationChargeByInvoiceNumber(
  invoiceNumber: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow | null> {
  const { data, error } = await client
    .from("zoho_invoice_authorization_charges")
    .select("*")
    .eq("invoice_number", invoiceNumber)
    .in("status", ACTIVE_CHARGE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function findAuthorizationChargeByReference(
  reference: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow | null> {
  const { data, error } = await client
    .from("zoho_invoice_authorization_charges")
    .select("*")
    .eq("paystack_reference", reference.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function findAuthorizationChargeById(
  id: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow | null> {
  const { data, error } = await client
    .from("zoho_invoice_authorization_charges")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function markAuthorizationChargeSubmitted(
  id: string,
  data: { paystackStatus: string; metadata?: Record<string, unknown> },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow> {
  const existing = await findAuthorizationChargeById(id, client);
  if (!existing) throw new Error("Authorization charge not found.");

  const currentMeta =
    existing.metadata != null &&
    typeof existing.metadata === "object" &&
    !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};

  const { data: row, error } = await client
    .from("zoho_invoice_authorization_charges")
    .update({
      status: "pending_webhook",
      paystack_status: data.paystackStatus,
      metadata: { ...currentMeta, ...(data.metadata ?? {}) } as Json,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Failed to mark authorization charge submitted.");
  }

  return row;
}

export async function markAuthorizationChargePaid(
  id: string,
  data: {
    zohoPaymentId: string;
    zohoStatus?: string | null;
    paystackStatus?: string | null;
    metadata?: Record<string, unknown>;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow> {
  const existing = await findAuthorizationChargeById(id, client);
  if (!existing) throw new Error("Authorization charge not found.");

  const currentMeta =
    existing.metadata != null &&
    typeof existing.metadata === "object" &&
    !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};

  const now = new Date().toISOString();
  const { data: row, error } = await client
    .from("zoho_invoice_authorization_charges")
    .update({
      status: "paid",
      zoho_payment_id: data.zohoPaymentId,
      zoho_status: data.zohoStatus ?? null,
      paystack_status: data.paystackStatus ?? existing.paystack_status,
      paid_at: now,
      metadata: { ...currentMeta, ...(data.metadata ?? {}) } as Json,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Failed to mark authorization charge paid.");
  }

  return row;
}

export async function markAuthorizationChargeFailed(
  id: string,
  data: { paystackStatus?: string | null; reason: string },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow> {
  const now = new Date().toISOString();
  const { data: row, error } = await client
    .from("zoho_invoice_authorization_charges")
    .update({
      status: "failed",
      paystack_status: data.paystackStatus ?? "failed",
      failed_at: now,
      last_reconcile_error: data.reason,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Failed to mark authorization charge failed.");
  }

  return row;
}

export async function markAuthorizationChargeReconcilePending(
  id: string,
  data: { paystackStatus?: string | null; reason: string },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow> {
  const existing = await findAuthorizationChargeById(id, client);
  if (!existing) throw new Error("Authorization charge not found.");

  const attempts = (existing.reconcile_attempts ?? 0) + 1;
  const now = new Date().toISOString();

  const { data: row, error } = await client
    .from("zoho_invoice_authorization_charges")
    .update({
      status: "zoho_reconcile_pending",
      paystack_status: data.paystackStatus ?? existing.paystack_status,
      reconcile_attempts: attempts,
      last_reconcile_attempt_at: now,
      last_reconcile_error: data.reason,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Failed to mark authorization charge reconcile pending.");
  }

  return row;
}

export async function markAuthorizationChargeReconcileFailed(
  id: string,
  data: { reason: string },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow> {
  const { data: row, error } = await client
    .from("zoho_invoice_authorization_charges")
    .update({
      status: "zoho_reconcile_failed",
      last_reconcile_error: data.reason,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Failed to mark authorization charge reconcile failed.");
  }

  return row;
}

export async function scheduleAuthorizationChargeReconcileRetry(
  id: string,
  data: {
    reconcileAttempts: number;
    nextReconcileAttemptAt: string | null;
    reason: string;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow> {
  const now = new Date().toISOString();
  const { data: row, error } = await client
    .from("zoho_invoice_authorization_charges")
    .update({
      status: "zoho_reconcile_pending",
      reconcile_attempts: data.reconcileAttempts,
      last_reconcile_attempt_at: now,
      next_reconcile_attempt_at: data.nextReconcileAttemptAt,
      last_reconcile_error: data.reason,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Failed to schedule authorization charge retry.");
  }

  return row;
}

export async function markAuthorizationChargeReconcileExhausted(
  id: string,
  reason: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow> {
  const { data: row, error } = await client
    .from("zoho_invoice_authorization_charges")
    .update({
      status: "zoho_reconcile_failed",
      last_reconcile_error: reason,
      next_reconcile_attempt_at: null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Failed to mark authorization charge exhausted.");
  }

  return row;
}

export type InsertAuthorizationChargeEventInput = {
  authorizationChargeId: string;
  providerEventId: string;
  eventType: string;
  paystackReference: string;
  payload?: Record<string, unknown>;
};

export type InsertAuthorizationChargeEventResult =
  | { outcome: "inserted" }
  | { outcome: "duplicate" };

export async function insertAuthorizationChargeEvent(
  input: InsertAuthorizationChargeEventInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<InsertAuthorizationChargeEventResult> {
  const { error } = await client.from("zoho_invoice_authorization_charge_events").insert({
    authorization_charge_id: input.authorizationChargeId,
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

export async function listAuthorizationChargesPendingReconciliation(
  limit: number,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("zoho_invoice_authorization_charges")
    .select("*")
    .eq("status", "zoho_reconcile_pending")
    .lt("reconcile_attempts", MAX_ZOHO_RECONCILE_ATTEMPTS)
    .or(`next_reconcile_attempt_at.is.null,next_reconcile_attempt_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}
