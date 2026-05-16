import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isOfferPastExpiry } from "./buildOfferExpiry";
import { recordAssignmentOutcome } from "./recordAssignmentOutcome";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";

export type ExpireOffersResult = {
  expiredCount: number;
  bookingIds: string[];
};

/**
 * Marks stale `offered` rows as `expired` and flags bookings for admin redispatch.
 * Safe to call manually or from a future cron job.
 */
export async function expireStaleAssignmentOffers(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend = createBookingCommandBackend(),
  now: Date = new Date(),
): Promise<ExpireOffersResult> {
  const { data, error } = await client
    .from("assignment_offers")
    .select("*")
    .eq("status", "offered");

  if (error) throw new Error(error.message);

  const bookingIds = new Set<string>();
  let expiredCount = 0;

  for (const offer of data ?? []) {
    if (!isOfferPastExpiry(offer.expires_at, now)) continue;

    const ts = now.toISOString();
    const { error: updateError } = await client
      .from("assignment_offers")
      .update({ status: "expired", updated_at: ts })
      .eq("id", offer.id)
      .eq("status", "offered");

    if (updateError) continue;

    expiredCount += 1;
    bookingIds.add(offer.booking_id);

    const booking = await backend.getBooking(offer.booking_id);
    if (booking?.status === "pending_assignment" && !booking.cleaner_id) {
      await recordAssignmentOutcome(backend, offer.booking_id, {
        status: "attention_required",
        path: null,
        cleanerId: offer.cleaner_id,
        offerId: offer.id,
        reason: "Assignment offer expired; booking needs redispatch.",
      });
    }
  }

  return { expiredCount, bookingIds: [...bookingIds] };
}
