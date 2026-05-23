import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AdminOfflinePaymentEventRow, Json } from "@/lib/database/types";
import type { AdminOfflinePaymentRail } from "./adminOfflinePaymentTypes";

export type InsertAdminOfflinePaymentEventInput = {
  bookingId: string;
  customerId: string;
  adminProfileId: string;
  rail: AdminOfflinePaymentRail;
  amountCents: number;
  currency: string;
  evidenceReference: string;
  providerReference: string;
  idempotencyKey: string;
  payload: Json;
};

export async function findAdminOfflinePaymentEventByIdempotencyKey(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<AdminOfflinePaymentEventRow | null> {
  const { data, error } = await client
    .from("admin_offline_payment_events")
    .select("*")
    .eq("idempotency_key", idempotencyKey.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function findFinalizedAdminOfflinePaymentEventForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<AdminOfflinePaymentEventRow | null> {
  const { data, error } = await client
    .from("admin_offline_payment_events")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("status", "finalized")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertAdminOfflinePaymentEvent(
  client: SupabaseClient<Database>,
  input: InsertAdminOfflinePaymentEventInput,
): Promise<AdminOfflinePaymentEventRow> {
  const { data, error } = await client
    .from("admin_offline_payment_events")
    .insert({
      booking_id: input.bookingId,
      customer_id: input.customerId,
      admin_profile_id: input.adminProfileId,
      rail: input.rail,
      amount_cents: input.amountCents,
      currency: input.currency,
      evidence_reference: input.evidenceReference,
      provider_reference: input.providerReference,
      idempotency_key: input.idempotencyKey.trim(),
      status: "pending",
      payload: input.payload,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function markAdminOfflinePaymentEventFinalized(
  client: SupabaseClient<Database>,
  eventId: string,
): Promise<void> {
  const { error } = await client
    .from("admin_offline_payment_events")
    .update({ status: "finalized" })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}

export async function markAdminOfflinePaymentEventFailed(
  client: SupabaseClient<Database>,
  eventId: string,
): Promise<void> {
  const { error } = await client
    .from("admin_offline_payment_events")
    .update({ status: "failed" })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}
