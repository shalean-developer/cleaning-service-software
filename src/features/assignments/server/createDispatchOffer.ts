import "server-only";

import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingCommandResult } from "@/features/bookings/server/commands/types";
import { buildOfferExpiresAt } from "./buildOfferExpiry";

const systemActor = { actorType: "service" as const, profileId: null };

export async function createDispatchOffer(
  backend: BookingCommandBackend,
  params: {
    bookingId: string;
    cleanerId: string;
    expiresAt?: string;
    reason?: string;
  },
): Promise<BookingCommandResult & { offerId?: string }> {
  const result = await executeBookingCommand(
    backend,
    {
      type: "OFFER_TO_CLEANER",
      actor: systemActor,
      bookingId: params.bookingId,
      cleanerId: params.cleanerId,
      expiresAt: params.expiresAt ?? buildOfferExpiresAt(),
      reason: params.reason ?? "Post-payment dispatch offer",
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
