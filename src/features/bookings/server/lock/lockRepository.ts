import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingLockRow, Database } from "@/lib/database/types";
import type { BookingLockInput } from "./types";
import { hashLockInputs } from "./hashLockInputs";
import { BOOKING_LOCK_TTL_MINUTES } from "./constants";

export async function findLockByIdempotencyKey(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<BookingLockRow | null> {
  const { data, error } = await client
    .from("booking_locks")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function findActiveLockByBookingId(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingLockRow | null> {
  const { data, error } = await client
    .from("booking_locks")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("status", "active")
    .order("locked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/** Returns the current active checkout lock for a booking, if any. */
export async function findLockByBookingId(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingLockRow | null> {
  return findActiveLockByBookingId(client, bookingId);
}

export async function findLockById(
  client: SupabaseClient<Database>,
  lockId: string,
): Promise<BookingLockRow | null> {
  const { data, error } = await client
    .from("booking_locks")
    .select("*")
    .eq("id", lockId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function insertBookingLock(
  client: SupabaseClient<Database>,
  params: {
    bookingId: string;
    customerId: string;
    input: BookingLockInput;
    lockedPriceCents: number;
    currency: string;
    lockedMetadata: Record<string, unknown>;
  },
): Promise<BookingLockRow> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + BOOKING_LOCK_TTL_MINUTES * 60_000);
  const inputsHash = hashLockInputs(params.input);

  const row = {
    booking_id: params.bookingId,
    customer_id: params.customerId,
    idempotency_key: params.input.checkoutIdempotencyKey,
    status: "active" as const,
    locked_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    locked_price_cents: params.lockedPriceCents,
    locked_currency: params.currency,
    locked_service_slug: params.input.pricingInput.serviceSlug,
    locked_schedule_start: params.input.scheduledStart,
    locked_schedule_end: params.input.scheduledEnd,
    locked_schedule_timezone: params.input.scheduleTimezone ?? "Africa/Johannesburg",
    locked_area_slug: params.input.areaSlug,
    locked_cleaner_preference: params.input.cleanerPreference,
    locked_metadata: params.lockedMetadata,
    client_quote_total_cents: params.input.clientQuoteTotalCents,
    inputs_hash: inputsHash,
    lock_version: 1,
    updated_at: now.toISOString(),
  };

  const { data, error } = await client.from("booking_locks").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function markLockConsumed(
  client: SupabaseClient<Database>,
  lockId: string,
): Promise<void> {
  const { error } = await client
    .from("booking_locks")
    .update({ status: "consumed", updated_at: new Date().toISOString() })
    .eq("id", lockId);

  if (error) throw new Error(error.message);
}

export async function markLockExpired(
  client: SupabaseClient<Database>,
  lockId: string,
): Promise<void> {
  const { error } = await client
    .from("booking_locks")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", lockId);

  if (error) throw new Error(error.message);
}

export function isLockExpired(lock: BookingLockRow, now: Date = new Date()): boolean {
  if (lock.status === "expired") return true;
  return new Date(lock.expires_at).getTime() <= now.getTime();
}
