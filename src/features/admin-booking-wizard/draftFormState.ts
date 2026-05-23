import { buildWizardSlot } from "@/features/booking-wizard/slot";
import type { PricingInput } from "@/features/pricing/server/types";
import { PRICING_FREQUENCIES, SERVICE_SLUGS } from "@/features/pricing/server/types";

export type AdminBookingWizardSelectedCustomer = {
  customerId: string;
  label: string;
  email: string | null;
  phone: string | null;
};

export type AdminBookingWizardFormState = {
  customerId: string;
  selectedCustomer: AdminBookingWizardSelectedCustomer | null;
  serviceSlug: (typeof SERVICE_SLUGS)[number] | "";
  date: string;
  time: string;
  addressLine1: string;
  suburb: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  frequency: (typeof PRICING_FREQUENCIES)[number];
};

export const EMPTY_ADMIN_BOOKING_WIZARD_FORM: AdminBookingWizardFormState = {
  customerId: "",
  selectedCustomer: null,
  serviceSlug: "",
  date: "",
  time: "",
  addressLine1: "",
  suburb: "",
  city: "",
  bedrooms: 2,
  bathrooms: 1,
  frequency: "once",
};

export function isAdminDraftFormReadyForSave(state: AdminBookingWizardFormState): boolean {
  if (!state.selectedCustomer?.customerId.trim()) return false;
  if (!state.customerId.trim()) return false;
  if (!state.serviceSlug) return false;
  if (!state.date.trim() || !state.time.trim()) return false;
  if (!state.addressLine1.trim() || !state.suburb.trim() || !state.city.trim()) return false;
  const slot = buildWizardSlot(state.date, state.time);
  return slot !== null;
}

export function buildAdminDraftPricingInput(
  state: AdminBookingWizardFormState,
): PricingInput | null {
  if (!state.serviceSlug) return null;
  return {
    serviceSlug: state.serviceSlug,
    bedrooms: state.bedrooms,
    bathrooms: state.bathrooms,
    frequency: state.frequency,
    teamSize: 1,
    requestedTeamSize: 1,
  };
}

export function buildAdminDraftRequestBody(
  state: AdminBookingWizardFormState,
  idempotencyKey: string,
) {
  const slot = buildWizardSlot(state.date, state.time);
  const pricingInput = buildAdminDraftPricingInput(state);
  if (!slot || !pricingInput || !state.serviceSlug) {
    return null;
  }

  return {
    customerId: state.customerId.trim(),
    idempotencyKey,
    scheduledStart: slot.scheduledStart,
    scheduledEnd: slot.scheduledEnd,
    pricingInput,
    address: {
      addressLine1: state.addressLine1.trim(),
      suburb: state.suburb.trim(),
      city: state.city.trim(),
    },
    cleanerPreferenceMode: "best_available" as const,
  };
}
