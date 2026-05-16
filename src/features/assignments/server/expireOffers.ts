import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { EXPIRE_OFFERS_BATCH_SIZE } from "./constants";
import { processBookingAfterOfferExpiry } from "./processBookingAfterOfferExpiry";

export type ExpireOffersResult = {
  expiredCount: number;
  bookingIds: string[];
  redispatchedBookingIds: string[];
  attentionBookingIds: string[];
};

/**
 * Marks stale `offered` rows as `expired` and flags bookings for admin redispatch.
 * Idempotent: already-expired rows are not selected; updates use status = offered guard.
 * Safe to call from cron or manual ops.
 */
export async function expireStaleAssignmentOffers(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend = createBookingCommandBackend(),
  now: Date = new Date(),
  batchSize: number = EXPIRE_OFFERS_BATCH_SIZE,
): Promise<ExpireOffersResult> {
  const nowIso = now.toISOString();

  const { data, error } = await client
    .from("assignment_offers")
    .select("*")
    .eq("status", "offered")
    .not("expires_at", "is", null)
    .lte("expires_at", nowIso)
    .order("expires_at", { ascending: true })
    .limit(batchSize);

  if (error) throw new Error(error.message);

  const bookingIds = new Set<string>();
  let expiredCount = 0;

  for (const offer of data ?? []) {
    const { data: updated, error: updateError } = await client
      .from("assignment_offers")
      .update({ status: "expired", updated_at: nowIso })
      .eq("id", offer.id)
      .eq("status", "offered")
      .select("id");

    if (updateError || !updated?.length) continue;

    expiredCount += 1;
    bookingIds.add(offer.booking_id);
  }

  const redispatchedBookingIds: string[] = [];
  const attentionBookingIds: string[] = [];

  for (const bookingId of bookingIds) {
    const outcome = await processBookingAfterOfferExpiry(client, backend, bookingId, now);
    if (outcome.redispatched) {
      redispatchedBookingIds.push(bookingId);
    } else if (outcome.attentionRequired) {
      attentionBookingIds.push(bookingId);
    }
  }

  return {
    expiredCount,
    bookingIds: [...bookingIds],
    redispatchedBookingIds,
    attentionBookingIds,
  };
}
