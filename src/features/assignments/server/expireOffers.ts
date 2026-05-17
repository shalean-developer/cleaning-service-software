import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { buildCronExpireOfferAuditIdempotencyKey } from "./recordAssignmentOfferExpiredAudit";
import { EXPIRE_OFFERS_BATCH_SIZE } from "./constants";
import { processBookingAfterOfferExpiry } from "./processBookingAfterOfferExpiry";

const serviceActor = { actorType: "service" as const, profileId: null };

export type ExpireOffersResult = {
  expiredCount: number;
  bookingIds: string[];
  redispatchedBookingIds: string[];
  attentionBookingIds: string[];
};

/**
 * Expires stale `offered` rows via `EXPIRE_ASSIGNMENT_OFFER` and runs booking follow-up.
 * Read-only offer scan on the Supabase client; status writes go through the command backend.
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
    const cmdResult = await executeBookingCommand(backend, {
      type: "EXPIRE_ASSIGNMENT_OFFER",
      actor: serviceActor,
      bookingId: offer.booking_id,
      offerId: offer.id,
      cleanerId: offer.cleaner_id,
      expiredAt: nowIso,
      idempotencyKey: buildCronExpireOfferAuditIdempotencyKey(offer.id),
      metadata: {
        offerId: offer.id,
        cleanerId: offer.cleaner_id,
        expiredAt: nowIso,
        expirySource: "cron",
        previousOfferStatus: "offered",
        expiresAt: offer.expires_at,
      },
    });

    if (!cmdResult.ok) {
      console.warn(
        JSON.stringify({
          event: "assignment_offer_expire_command_failed",
          bookingId: offer.booking_id,
          offerId: offer.id,
          code: cmdResult.code,
          message: cmdResult.message,
        }),
      );
      continue;
    }

    if (!cmdResult.idempotent) {
      expiredCount += 1;
    }
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
