import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PaymentRow } from "@/lib/database/types";

export async function findPaymentByProviderRef(
  client: SupabaseClient<Database>,
  providerRef: string,
): Promise<PaymentRow | null> {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("provider_ref", providerRef)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function findPaymentByIdempotencyKey(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<PaymentRow | null> {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePaymentProviderRef(
  client: SupabaseClient<Database>,
  paymentId: string,
  providerRef: string,
): Promise<void> {
  const { error } = await client
    .from("payments")
    .update({ provider_ref: providerRef, updated_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (error) throw new Error(error.message);
}

export async function findPendingPaymentForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<PaymentRow | null> {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .in("status", ["pending", "initialized"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function findPaidPaymentForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<PaymentRow | null> {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePaymentOfflineProvider(
  client: SupabaseClient<Database>,
  paymentId: string,
  patch: {
    provider: string;
    providerRef: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const update: Record<string, unknown> = {
    provider: patch.provider,
    provider_ref: patch.providerRef,
    updated_at: new Date().toISOString(),
  };
  if (patch.metadata !== undefined) {
    update.metadata = patch.metadata;
  }
  const { error } = await client.from("payments").update(update).eq("id", paymentId);
  if (error) throw new Error(error.message);
}

export async function getPaymentById(
  client: SupabaseClient<Database>,
  paymentId: string,
): Promise<PaymentRow | null> {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePaymentLinkMetadata(
  client: SupabaseClient<Database>,
  paymentId: string,
  patch: {
    providerRef?: string;
    paymentLinkExpiresAt?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.providerRef !== undefined) {
    update.provider_ref = patch.providerRef;
  }
  if (patch.paymentLinkExpiresAt !== undefined) {
    update.payment_link_expires_at = patch.paymentLinkExpiresAt;
  }
  if (patch.metadata !== undefined) {
    update.metadata = patch.metadata;
  }
  const { error } = await client.from("payments").update(update).eq("id", paymentId);
  if (error) throw new Error(error.message);
}
