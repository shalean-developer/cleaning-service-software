import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, MonthlyServiceAuthorizationRow } from "@/lib/database/types";

export type InsertMonthlyServiceAuthorizationInput = {
  bookingId: string;
  customerId: string;
  adminProfileId: string;
  monthlyAccountId: string;
  amountCents: number;
  reason: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
};

export async function findMonthlyServiceAuthorizationByIdempotencyKey(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<MonthlyServiceAuthorizationRow | null> {
  const { data, error } = await client
    .from("monthly_service_authorizations")
    .select("*")
    .eq("idempotency_key", idempotencyKey.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function findMonthlyServiceAuthorizationForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<MonthlyServiceAuthorizationRow | null> {
  const { data, error } = await client
    .from("monthly_service_authorizations")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertMonthlyServiceAuthorization(
  client: SupabaseClient<Database>,
  input: InsertMonthlyServiceAuthorizationInput,
): Promise<MonthlyServiceAuthorizationRow> {
  const { data, error } = await client
    .from("monthly_service_authorizations")
    .insert({
      booking_id: input.bookingId,
      customer_id: input.customerId,
      admin_profile_id: input.adminProfileId,
      monthly_account_id: input.monthlyAccountId,
      amount_cents: input.amountCents,
      status: "authorized",
      reason: input.reason.trim(),
      idempotency_key: input.idempotencyKey.trim(),
      payload: (input.payload ?? {}) as Json,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not create monthly service authorization.");
  return data;
}

export async function hasActiveMonthlyServiceAuthorization(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<boolean> {
  const { count, error } = await client
    .from("monthly_service_authorizations")
    .select("*", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("status", "authorized");
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
