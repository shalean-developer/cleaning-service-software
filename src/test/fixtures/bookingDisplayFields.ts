import type { BookingDisplayFields } from "@/features/dashboards/server/parseBookingDisplay";

/** Realistic defaults for BookingDisplayFields in unit tests. */
export function testBookingDisplayFields(
  partial: Partial<BookingDisplayFields> = {},
): BookingDisplayFields {
  return {
    serviceSlug: "regular-cleaning",
    serviceLabel: "Regular cleaning",
    suburb: "Sea Point",
    city: "Cape Town",
    addressLine: "12 Main Road",
    locationSummary: "Sea Point, Cape Town",
    homeSizeSummary: "2 bedrooms · 1 bathroom",
    cleaningIntensityLabel: "Standard",
    equipmentSupplyLabel: "Customer supplies",
    equipmentSupplyOperationalLabel: "Customer supplies equipment",
    frequencyLabel: "Once off",
    addonsSummary: null,
    teamSupportLabel: null,
    teamSupportCleanerNote: null,
    isTwoCleanerRequest: false,
    teamRequestFulfillmentLabel: null,
    cleanerPreferenceMode: "best_available",
    preferredCleanerId: null,
    specialInstructions: null,
    operationalAccessNotes: null,
    contactPhone: "+27821234567",
    contactPhoneDisplay: "082 123 4567",
    assignmentAttention: null,
    assignmentReason: null,
    assignmentVisibilityKey: null,
    assignmentCustomerMessage: null,
    showCustomerAssignmentWarning: false,
    ...partial,
  };
}
