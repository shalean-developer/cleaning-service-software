import type { AssignmentOfferRow, BookingCleanerRole } from "@/lib/database/types";

export const DEFAULT_OFFER_TEAM_ROLE: BookingCleanerRole = "primary";

export function offerTeamRole(offer: Pick<AssignmentOfferRow, "team_role">): BookingCleanerRole {
  return offer.team_role ?? DEFAULT_OFFER_TEAM_ROLE;
}

export function isSupportOfferTeamRole(role: BookingCleanerRole): boolean {
  return role === "support";
}

/** Whether a booking status allows this offer slot to appear in cleaner offer lists. */
export function offerBookingStatusAllowed(
  offer: Pick<AssignmentOfferRow, "team_role">,
  bookingStatus: string,
): boolean {
  if (isSupportOfferTeamRole(offerTeamRole(offer))) {
    return bookingStatus === "assigned" || bookingStatus === "in_progress";
  }
  return bookingStatus === "pending_assignment";
}
