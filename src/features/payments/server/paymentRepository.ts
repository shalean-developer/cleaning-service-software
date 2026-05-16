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
