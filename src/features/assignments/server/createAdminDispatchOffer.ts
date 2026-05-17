import "server-only";

import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingCommandResult } from "@/features/bookings/server/commands/types";
import { buildOfferExpiresAt } from "./buildOfferExpiry";

export async function createAdminDispatchOffer(
  backend: BookingCommandBackend,
  params: {
    bookingId: string;
    cleanerId: string;
    adminProfileId: string;
    expiresAt?: string;
    reason: string;
  },
): Promise<BookingCommandResult & { offerId?: string }> {
  const result = await executeBookingCommand(
    backend,
    {
      type: "OFFER_TO_CLEANER",
      actor: { actorType: "admin", profileId: params.adminProfileId },
      bookingId: params.bookingId,
      cleanerId: params.cleanerId,
      expiresAt: params.expiresAt ?? buildOfferExpiresAt(),
      reason: params.reason,
      idempotencyKey: `assignment:offer:${params.bookingId}:${params.cleanerId}`,
    },
    {},
  );

  if (!result.ok) return result;

  const offers = await backend.listOffersForBooking(params.bookingId);
  const offer = offers.find(
    (o) => o.cleaner_id === params.cleanerId && o.status === "offered",
  );

  return { ...result, offerId: offer?.id };
}
