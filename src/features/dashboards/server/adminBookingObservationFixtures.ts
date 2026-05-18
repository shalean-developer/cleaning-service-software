import type { AdminBookingObservation } from "./types";

/** Default observation fields for admin list item test fixtures. */
export const EMPTY_ADMIN_BOOKING_OBSERVATION: AdminBookingObservation = {
  isTwoCleanerRequest: false,
  operationalLoad: {
    isTwoCleanerRequest: false,
    isShaleanEquipment: false,
    isHeavyIntensity: false,
    operationalLoadScore: 0,
  },
  teamRequestFulfillment: null,
  teamRequestFulfillmentLabel: null,
  teamSupportOps: {
    supportingCleaner: null,
    teamSupportNotes: null,
    coordinationStatus: null,
  },
  supportingCleanerLabel: null,
  coordinationStatusLabel: null,
  hasTeamSupportNotes: false,
};
