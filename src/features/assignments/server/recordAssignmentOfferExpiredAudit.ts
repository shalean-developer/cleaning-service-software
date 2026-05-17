import "server-only";

import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandResult } from "@/features/bookings/server/commands/types";

const serviceActor = { actorType: "service" as const, profileId: null };

export function buildCronExpireOfferAuditIdempotencyKey(offerId: string): string {
  return `cron:expire-offer:${offerId}`;
}

export type RecordAssignmentOfferExpiredAuditInput = {
  bookingId: string;
  offerId: string;
  cleanerId: string;
  expiredAt: string;
};

export async function recordAssignmentOfferExpiredAudit(
  backend: BookingCommandBackend,
  input: RecordAssignmentOfferExpiredAuditInput,
): Promise<BookingCommandResult> {
  return executeBookingCommand(backend, {
    type: "RECORD_ASSIGNMENT_OFFER_EXPIRED",
    actor: serviceActor,
    bookingId: input.bookingId,
    offerId: input.offerId,
    cleanerId: input.cleanerId,
    expiredAt: input.expiredAt,
    idempotencyKey: buildCronExpireOfferAuditIdempotencyKey(input.offerId),
    metadata: {
      offerId: input.offerId,
      cleanerId: input.cleanerId,
      expiredAt: input.expiredAt,
      expirySource: "cron",
      previousOfferStatus: "offered",
    },
  });
}
