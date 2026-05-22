import "server-only";

import { createAdminCancelOpenOffer } from "@/features/assignments/server/createAdminCancelOpenOffer";
import { listOffersForBooking } from "@/features/assignments/server/offerRepository";
import { syncRosterOnOfferEnded } from "@/features/assignments/server/rosterSyncForOffer";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import type { AssignmentOfferRow, Database } from "@/lib/database/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const BOOKING_ARCHIVE_CANCEL_REASON = "Booking archived by admin";

export type CancelBookingOpenOffersResult = {
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

export async function cancelBookingOpenOffers(
  client: SupabaseClient<Database>,
  params: {
    bookingId: string;
    adminProfileId: string;
    reason?: string | null;
  },
): Promise<CancelBookingOpenOffersResult> {
  const reason = params.reason?.trim() || BOOKING_ARCHIVE_CANCEL_REASON;
  const offers = await listOffersForBooking(client, params.bookingId);
  const openOffers = offers.filter((o) => o.status === "offered");

  let openOffersCancelled = 0;
  for (const offer of openOffers) {
    const cancelled = await cancelSingleOpenOffer(offer, params.adminProfileId, reason);
    if (cancelled) openOffersCancelled += 1;
  }

  return { openOffersCancelled, offersExamined: openOffers.length };
}
