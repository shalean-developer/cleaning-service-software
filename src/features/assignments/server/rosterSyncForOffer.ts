import type { BookingCommand } from "@/features/bookings/server/commands/types";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type {
  AssignmentOfferRow,
  BookingCleanerRole,
  BookingCleanerStatus,
} from "@/lib/database/types";
import { isTeamOffersEnabled } from "./teamOffersConfig";
import { offerTeamRole } from "./offerTeamRole";

export async function syncRosterOnOfferCreated(
  backend: BookingCommandBackend,
  cmd: BookingCommand & { type: "OFFER_TO_CLEANER" },
  params: {
    bookingId: string;
    cleanerId: string;
    teamRole: BookingCleanerRole;
  },
): Promise<string | null> {
  if (!isTeamOffersEnabled()) return null;
  const row = await backend.upsertBookingCleanerRoster({
    bookingId: params.bookingId,
    cleanerId: params.cleanerId,
    role: params.teamRole,
    status: "offered",
    assignedByProfileId: cmd.actor.profileId,
  });
  return row.id;
}

export async function syncRosterOnOfferEnded(
  backend: BookingCommandBackend,
  offer: AssignmentOfferRow,
  rosterStatus: BookingCleanerStatus,
): Promise<void> {
  if (!isTeamOffersEnabled()) return;
  if (offer.roster_id) {
    await backend.updateBookingCleanerRosterStatus(offer.roster_id, rosterStatus);
    return;
  }
  const roster = await backend.listBookingCleanersForBooking(offer.booking_id);
  const match = roster.find(
    (r) => r.cleaner_id === offer.cleaner_id && r.role === offerTeamRole(offer),
  );
  if (match) {
    await backend.updateBookingCleanerRosterStatus(match.id, rosterStatus);
  }
}

export async function syncRosterOnOfferAccepted(
  backend: BookingCommandBackend,
  offer: AssignmentOfferRow,
): Promise<void> {
  if (!isTeamOffersEnabled()) return;
  if (offer.roster_id) {
    await backend.updateBookingCleanerRosterStatus(offer.roster_id, "accepted");
    return;
  }
  const roster = await backend.listBookingCleanersForBooking(offer.booking_id);
  const match = roster.find(
    (r) => r.cleaner_id === offer.cleaner_id && r.role === offerTeamRole(offer),
  );
  if (match) {
    await backend.updateBookingCleanerRosterStatus(match.id, "accepted");
  }
}
