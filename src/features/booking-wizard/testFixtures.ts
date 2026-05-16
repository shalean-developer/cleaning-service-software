import { INITIAL_WIZARD_STATE, type BookingWizardState } from "./types";

export function filledState(
  overrides: Partial<BookingWizardState> = {},
): BookingWizardState {
  return {
    ...INITIAL_WIZARD_STATE,
    serviceSlug: "regular-cleaning",
    date: "2030-06-01",
    time: "10:00",
    addressLine1: "12 Main Rd",
    suburb: "Cape Town",
    city: "Cape Town",
    bedrooms: 2,
    bathrooms: 1,
    cleanerPreferenceMode: "best_available",
    reviewConfirmed: true,
    ...overrides,
  };
}
