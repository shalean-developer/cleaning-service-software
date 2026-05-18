import "server-only";

import { createAdminCancelOpenOffer } from "@/features/assignments/server/createAdminCancelOpenOffer";
import { listOffersForCleaner } from "@/features/assignments/server/offerRepository";
import { syncRosterOnOfferEnded } from "@/features/assignments/server/rosterSyncForOffer";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignmentOfferRow, Database } from "@/lib/database/types";

const LIFECYCLE_CANCEL_REASON = "Cleaner lifecycle: open offer withdrawn";

export type CancelCleanerOpenOffersResult = {
  openOffersCancelled: number;
  offersExamined: number;
};

async function cancelSingleOpenOffer(
  offer: AssignmentOfferRow,
  adminProfileId: string,
  reason: string,
): Promise<boolean> {
  const backend = createBookingCommandBackend();
  const booking = await backend.getBooking(offer.booking_id);
  if (!booking) return false;

  if (booking.status === "pending_assignment") {
    const result = await createAdminCancelOpenOffer(backend, {
      bookingId: offer.booking_id,
      offerId: offer.id,
      adminProfileId,
      reason,
    });
    if (!result.ok) {
      if (result.code === "OFFER_NOT_OPEN") return false;
      throw new Error(`${result.code}: ${result.message}`);
    }
    return !result.idempotent;
  }

  if (offer.status !== "offered") return false;

  const now = new Date().toISOString();
  const cancelled: AssignmentOfferRow = {
    ...offer,
    status: "cancelled",
    responded_at: now,
    updated_at: now,
  };
  await backend.updateOffer(cancelled);
  await syncRosterOnOfferEnded(backend, cancelled, "removed");
  return true;
}

/**
 * Cancels all open (`offered`) assignment offers for a cleaner.
 * Uses `CANCEL_OPEN_ASSIGNMENT_OFFER` when the booking is `pending_assignment`;
 * otherwise updates the offer row via the command backend (e.g. support offers on active jobs).
 */
export async function cancelCleanerOpenOffers(
  client: SupabaseClient<Database>,
  params: {
    cleanerId: string;
    adminProfileId: string;
    reason?: string | null;
  },
): Promise<CancelCleanerOpenOffersResult> {
  const reason = params.reason?.trim() || LIFECYCLE_CANCEL_REASON;
  const offers = await listOffersForCleaner(client, params.cleanerId, ["offered"]);

  let openOffersCancelled = 0;
  for (const offer of offers) {
    const cancelled = await cancelSingleOpenOffer(offer, params.adminProfileId, reason);
    if (cancelled) openOffersCancelled += 1;
  }

  return { openOffersCancelled, offersExamined: offers.length };
}
