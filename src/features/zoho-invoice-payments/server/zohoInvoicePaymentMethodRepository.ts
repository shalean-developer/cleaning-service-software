import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, ZohoInvoicePaymentMethodRow } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

export type InsertZohoInvoicePaymentMethodInput = {
  customerEmail: string;
  customerName: string | null;
  paystackCustomerCode: string | null;
  authorizationCode: string;
  authorizationSignature: string | null;
  cardType: string | null;
  bank: string | null;
  last4: string | null;
  expMonth: string | null;
  expYear: string | null;
  reusable: boolean;
  isDefault: boolean;
  consentTextVersion: string;
  consentedAt: string;
  sourceInvoiceNumber: string | null;
  sourceZohoInvoicePaymentId: string;
  metadata?: Record<string, unknown>;
};

export async function findZohoInvoicePaymentMethodById(
  id: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentMethodRow | null> {
  const { data, error } = await client
    .from("zoho_invoice_payment_methods")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function listEligibleZohoInvoicePaymentMethodsForEmail(
  customerEmail: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentMethodRow[]> {
  const { data, error } = await client
    .from("zoho_invoice_payment_methods")
    .select("*")
    .eq("customer_email", customerEmail.trim().toLowerCase())
    .eq("reusable", true)
    .is("revoked_at", null)
    .order("is_default", { ascending: false })
    .order("consented_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findZohoInvoicePaymentMethodByAuthorizationCode(
  authorizationCode: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentMethodRow | null> {
  const { data, error } = await client
    .from("zoho_invoice_payment_methods")
    .select("*")
    .eq("authorization_code", authorizationCode.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function findActiveDefaultZohoInvoicePaymentMethodByEmail(
  customerEmail: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentMethodRow | null> {
  const { data, error } = await client
    .from("zoho_invoice_payment_methods")
    .select("*")
    .eq("customer_email", customerEmail.trim().toLowerCase())
    .eq("is_default", true)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function insertZohoInvoicePaymentMethod(
  input: InsertZohoInvoicePaymentMethodInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<{ row: ZohoInvoicePaymentMethodRow; duplicate: boolean }> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("zoho_invoice_payment_methods")
    .insert({
      customer_email: input.customerEmail.trim().toLowerCase(),
      customer_name: input.customerName,
      paystack_customer_code: input.paystackCustomerCode,
      authorization_code: input.authorizationCode.trim(),
      authorization_signature: input.authorizationSignature,
      card_type: input.cardType,
      bank: input.bank,
      last4: input.last4,
      exp_month: input.expMonth,
      exp_year: input.expYear,
      reusable: input.reusable,
      is_default: input.isDefault,
      consent_text_version: input.consentTextVersion,
      consented_at: input.consentedAt,
      source_invoice_number: input.sourceInvoiceNumber,
      source_zoho_invoice_payment_id: input.sourceZohoInvoicePaymentId,
      metadata: (input.metadata ?? {}) as Json,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await findZohoInvoicePaymentMethodByAuthorizationCode(
        input.authorizationCode,
        client,
      );
      if (!existing) {
        throw new Error(error.message);
      }
      return { row: existing, duplicate: true };
    }
    throw new Error(error.message ?? "Failed to insert zoho_invoice_payment_methods row.");
  }

  if (!data) {
    throw new Error("Failed to insert zoho_invoice_payment_methods row.");
  }

  return { row: data, duplicate: false };
}

export async function countActiveZohoInvoicePaymentMethods(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<number> {
  const { count, error } = await client
    .from("zoho_invoice_payment_methods")
    .select("id", { count: "exact", head: true })
    .is("revoked_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getLatestZohoInvoicePaymentMethodConsentAt(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<string | null> {
  const { data, error } = await client
    .from("zoho_invoice_payment_methods")
    .select("consented_at")
    .is("revoked_at", null)
    .order("consented_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.consented_at ?? null;
}

export type AdminZohoInvoicePaymentMethodListRow = {
  id: string;
  customer_email: string;
  card_type: string | null;
  bank: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  reusable: boolean;
  is_default: boolean;
  consented_at: string;
  revoked_at: string | null;
  source_invoice_number: string | null;
};

export async function listRecentZohoInvoicePaymentMethodsForAdmin(
  limit = 20,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminZohoInvoicePaymentMethodListRow[]> {
  const { data, error } = await client
    .from("zoho_invoice_payment_methods")
    .select(
      "id, customer_email, card_type, bank, last4, exp_month, exp_year, reusable, is_default, consented_at, revoked_at, source_invoice_number",
    )
    .order("consented_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminZohoInvoicePaymentMethodListRow[];
}

export async function listZohoInvoicePaymentMethodsByCustomerEmail(
  customerEmail: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminZohoInvoicePaymentMethodListRow[]> {
  const { data, error } = await client
    .from("zoho_invoice_payment_methods")
    .select(
      "id, customer_email, card_type, bank, last4, exp_month, exp_year, reusable, is_default, consented_at, revoked_at, source_invoice_number",
    )
    .eq("customer_email", customerEmail.trim().toLowerCase())
    .order("consented_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminZohoInvoicePaymentMethodListRow[];
}

export function formatMaskedPaymentMethodDisplay(
  method: Pick<AdminZohoInvoicePaymentMethodListRow, "card_type" | "last4" | "bank">,
): string {
  const label = method.card_type?.trim() || method.bank?.trim() || "Card";
  const last4 = method.last4?.trim();
  return last4 ? `${label} ending ${last4}` : label;
}

export type PaymentMethodAdminListFilters = {
  customerEmail?: string;
  status?: "active" | "revoked" | "all";
  limit?: number;
};

export async function listPaymentMethodsForCustomerEmail(
  customerEmail: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentMethodRow[]> {
  const { data, error } = await client
    .from("zoho_invoice_payment_methods")
    .select("*")
    .eq("customer_email", customerEmail.trim().toLowerCase())
    .order("revoked_at", { ascending: true, nullsFirst: true })
    .order("is_default", { ascending: false })
    .order("consented_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listPaymentMethodsForAdmin(
  filters: PaymentMethodAdminListFilters = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentMethodRow[]> {
  const limit = filters.limit ?? 50;
  let query = client.from("zoho_invoice_payment_methods").select("*");

  if (filters.customerEmail?.trim()) {
    query = query.eq("customer_email", filters.customerEmail.trim().toLowerCase());
  }

  const status = filters.status ?? "all";
  if (status === "active") {
    query = query.is("revoked_at", null);
  } else if (status === "revoked") {
    query = query.not("revoked_at", "is", null);
  }

  const { data, error } = await query
    .order("consented_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export type RecordPaymentMethodAuditInput = {
  paymentMethodId: string;
  action: string;
  actorType: "customer" | "admin" | "system";
  actorId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordPaymentMethodAudit(
  input: RecordPaymentMethodAuditInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<void> {
  const { error } = await client.from("zoho_invoice_payment_method_audit").insert({
    payment_method_id: input.paymentMethodId,
    action: input.action,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    reason: input.reason?.trim() || null,
    metadata: (input.metadata ?? {}) as Json,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function promoteNextDefaultPaymentMethod(
  customerEmail: string,
  excludeId: string,
  client: SupabaseClient<Database>,
): Promise<void> {
  const { data: candidates, error } = await client
    .from("zoho_invoice_payment_methods")
    .select("id")
    .eq("customer_email", customerEmail.trim().toLowerCase())
    .is("revoked_at", null)
    .eq("reusable", true)
    .neq("id", excludeId)
    .order("consented_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  await client
    .from("zoho_invoice_payment_methods")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("customer_email", customerEmail.trim().toLowerCase())
    .is("revoked_at", null);

  const nextId = candidates?.[0]?.id;
  if (!nextId) return;

  await client
    .from("zoho_invoice_payment_methods")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", nextId);
}

export type RevokePaymentMethodByCustomerInput = {
  paymentMethodId: string;
  customerEmail: string;
  actorProfileId: string;
  reason?: string | null;
};

export type RevokePaymentMethodResult =
  | { ok: true; idempotent: boolean; paymentMethodId: string }
  | { ok: false; code: string; message: string };

export async function revokePaymentMethodByCustomer(
  input: RevokePaymentMethodByCustomerInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<RevokePaymentMethodResult> {
  const method = await findZohoInvoicePaymentMethodById(input.paymentMethodId, client);
  if (!method) {
    return { ok: false, code: "NOT_FOUND", message: "Payment method not found." };
  }

  const normalizedEmail = input.customerEmail.trim().toLowerCase();
  if (method.customer_email !== normalizedEmail) {
    return { ok: false, code: "FORBIDDEN", message: "You cannot revoke this payment method." };
  }

  if (method.revoked_at) {
    return { ok: true, idempotent: true, paymentMethodId: method.id };
  }

  const now = new Date().toISOString();
  const wasDefault = method.is_default;

  const { error } = await client
    .from("zoho_invoice_payment_methods")
    .update({
      revoked_at: now,
      is_default: false,
      revoke_reason: input.reason?.trim() || null,
      revoked_by_user_id: input.actorProfileId,
      revoked_by_admin_id: null,
      revocation_source: "customer",
      updated_at: now,
    })
    .eq("id", method.id);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: "Could not revoke payment method." };
  }

  if (wasDefault) {
    await promoteNextDefaultPaymentMethod(method.customer_email, method.id, client);
  }

  await recordPaymentMethodAudit(
    {
      paymentMethodId: method.id,
      action: "revoked",
      actorType: "customer",
      actorId: input.actorProfileId,
      reason: input.reason?.trim() || null,
      metadata: { revocation_source: "customer" },
    },
    client,
  );

  return { ok: true, idempotent: false, paymentMethodId: method.id };
}

export type RevokePaymentMethodByAdminInput = {
  paymentMethodId: string;
  adminProfileId: string;
  reason: string;
};

export async function revokePaymentMethodByAdmin(
  input: RevokePaymentMethodByAdminInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<RevokePaymentMethodResult> {
  const method = await findZohoInvoicePaymentMethodById(input.paymentMethodId, client);
  if (!method) {
    return { ok: false, code: "NOT_FOUND", message: "Payment method not found." };
  }

  if (method.revoked_at) {
    return { ok: true, idempotent: true, paymentMethodId: method.id };
  }

  const now = new Date().toISOString();
  const wasDefault = method.is_default;

  const { error } = await client
    .from("zoho_invoice_payment_methods")
    .update({
      revoked_at: now,
      is_default: false,
      revoke_reason: input.reason.trim(),
      revoked_by_user_id: null,
      revoked_by_admin_id: input.adminProfileId,
      revocation_source: "admin",
      updated_at: now,
    })
    .eq("id", method.id);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: "Could not revoke payment method." };
  }

  if (wasDefault) {
    await promoteNextDefaultPaymentMethod(method.customer_email, method.id, client);
  }

  await recordPaymentMethodAudit(
    {
      paymentMethodId: method.id,
      action: "revoked",
      actorType: "admin",
      actorId: input.adminProfileId,
      reason: input.reason.trim(),
      metadata: { revocation_source: "admin" },
    },
    client,
  );

  return { ok: true, idempotent: false, paymentMethodId: method.id };
}

export type MarkPaymentMethodLastUsedInput = {
  paymentMethodId: string;
  invoiceNumber: string;
};

export async function markPaymentMethodLastUsed(
  input: MarkPaymentMethodLastUsedInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from("zoho_invoice_payment_methods")
    .update({
      last_used_at: now,
      last_used_invoice_number: input.invoiceNumber.trim(),
      updated_at: now,
    })
    .eq("id", input.paymentMethodId);

  if (error) {
    throw new Error(error.message);
  }
}

/** Spec aliases (Phase 9). */
export const findPaymentMethodById = findZohoInvoicePaymentMethodById;
export const listPaymentMethodsForCustomerUser = listPaymentMethodsForCustomerEmail;
