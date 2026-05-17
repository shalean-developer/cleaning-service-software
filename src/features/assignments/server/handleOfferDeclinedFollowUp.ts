import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignmentOfferRow, Database } from "@/lib/database/types";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { readAssignmentMetadata } from "./assignmentMetadata";
import {
  isRedispatchEligiblePath,
  processBookingAfterOfferEnded,
  resolveAssignmentPathForBooking,
} from "./processBookingAfterOfferEnded";
import { recordAssignmentOutcome } from "./recordAssignmentOutcome";

/**
 * Runs after a successful (non-idempotent) cleaner decline.
 * Best-available paths auto-redispatch; selected path escalates to admin attention.
 */
export async function handleOfferDeclinedFollowUp(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  offer: AssignmentOfferRow,
): Promise<void> {
  const booking = await backend.getBooking(offer.booking_id);
  if (!booking) return;

  const meta = readAssignmentMetadata(booking.metadata);
  const path = meta?.path ?? (await resolveAssignmentPathForBooking(client, booking));

  if (path === "selected" || !isRedispatchEligiblePath(path)) {
    await recordAssignmentOutcome(backend, offer.booking_id, {
      status: "attention_required",
      path: path ?? "selected",
      cleanerId: offer.cleaner_id,
      offerId: offer.id,
      reason:
        path === "selected"
          ? "Cleaner declined offer; selected cleaner requires admin redispatch."
          : "Cleaner declined offer; booking needs redispatch.",
    });
    return;
  }

  await processBookingAfterOfferEnded(client, backend, {
    bookingId: offer.booking_id,
    outcome: "declined",
    endedOfferId: offer.id,
    endedCleanerId: offer.cleaner_id,
  });
}
