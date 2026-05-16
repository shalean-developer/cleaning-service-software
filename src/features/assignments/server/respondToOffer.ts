import "server-only";

import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingCommandResult } from "@/features/bookings/server/commands/types";
import type { AssignmentOfferRow } from "@/lib/database/types";

export async function acceptCleanerOffer(
  backend: BookingCommandBackend,
  offer: AssignmentOfferRow,
  actingCleanerId: string,
  cleanerProfileId: string,
): Promise<BookingCommandResult> {
  if (offer.cleaner_id !== actingCleanerId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Cannot accept another cleaner's offer.",
    };
  }

  return executeBookingCommand(
    backend,
    {
      type: "ACCEPT_CLEANER_ASSIGNMENT",
      actor: { actorType: "cleaner", profileId: cleanerProfileId },
      bookingId: offer.booking_id,
      offerId: offer.id,
      idempotencyKey: `assignment:accept:${offer.id}`,
    },
    { actingCleanerId },
  );
}

export async function declineCleanerOffer(
  backend: BookingCommandBackend,
  offer: AssignmentOfferRow,
  actingCleanerId: string,
  cleanerProfileId: string,
): Promise<BookingCommandResult> {
  if (offer.cleaner_id !== actingCleanerId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Cannot decline another cleaner's offer.",
    };
  }

  return executeBookingCommand(
    backend,
    {
      type: "DECLINE_CLEANER_ASSIGNMENT",
      actor: { actorType: "cleaner", profileId: cleanerProfileId },
      bookingId: offer.booking_id,
      offerId: offer.id,
      idempotencyKey: `assignment:decline:${offer.id}`,
    },
    { actingCleanerId },
  );
}
