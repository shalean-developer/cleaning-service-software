import "server-only";

import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingCommandResult } from "@/features/bookings/server/commands/types";

export async function createAdminCancelOpenOffer(
  backend: BookingCommandBackend,
  params: {
    bookingId: string;
    offerId: string;
    adminProfileId: string;
    reason: string;
  },
): Promise<BookingCommandResult> {
  return executeBookingCommand(
    backend,
    {
      type: "CANCEL_OPEN_ASSIGNMENT_OFFER",
      actor: { actorType: "admin", profileId: params.adminProfileId },
      bookingId: params.bookingId,
      offerId: params.offerId,
      reason: params.reason,
      idempotencyKey: `admin:cancel-offer:${params.offerId}`,
    },
    {},
  );
}
