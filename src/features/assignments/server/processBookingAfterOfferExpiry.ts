import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { Database } from "@/lib/database/types";
import { processBookingAfterOfferEnded } from "./processBookingAfterOfferEnded";

export type { ProcessBookingAfterOfferEndedResult } from "./processBookingAfterOfferEnded";

/**
 * After one or more offers expired on a booking: set attention or redispatch (best_available only).
 * Thin wrapper over {@link processBookingAfterOfferEnded}.
 */
export async function processBookingAfterOfferExpiry(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  bookingId: string,
  now: Date = new Date(),
): Promise<{ redispatched: boolean; attentionRequired: boolean }> {
  return processBookingAfterOfferEnded(client, backend, {
    bookingId,
    outcome: "expired",
    now,
  });
}
