import { buildWizardSlot } from "@/features/booking-wizard/slot";
import type { CarpetStainSeverity } from "@/features/booking-wizard/carpetCleaningDisplay";
import type { OfficeSizeTier, OfficeWorkstationTier } from "@/features/booking-wizard/officeSizing";
import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  PricingInput,
  ServiceSlug,
} from "@/features/pricing/server/types";
import { PRICING_FREQUENCIES } from "@/features/pricing/server/types";
import { buildAdminDraftAddressPayload } from "./adminAddressCompose";
import { buildAdminDraftPricingInput } from "./adminPricingInput";

export type AdminBookingWizardSelectedCustomer = {
  customerId: string;
  label: string;
  email: string | null;
  phone: string | null;
};

export type AdminBookingWizardFormState = {
  customerId: string;
  selectedCustomer: AdminBookingWizardSelectedCustomer | null;
  serviceSlug: ServiceSlug | "";
  date: string;
  time: string;
  addressLine1: string;
  suburb: string;
  city: string;
  locationNotes: string;
  accessInstructions: string;
  gateCode: string;
  parkingInstructions: string;
  petNotes: string;
  bedrooms: number;
  bathrooms: number;
  extraRooms: number;
  cleaningIntensity: CleaningIntensity;
  equipmentSupply: EquipmentSupply;
  requestedTeamSize: 1 | 2;
  propertySizeSqm: number | null;
  officeSizeTier: OfficeSizeTier | null;
  officeWorkstations: OfficeWorkstationTier | null;
  frequency: (typeof PRICING_FREQUENCIES)[number];
  addons: AddonSlug[];
  carpetStainSeverity: CarpetStainSeverity | null;
  carpetPetStains: boolean;
  carpetGoodDryingAirflow: boolean;
  specialInstructions: string;
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
  locationNotes: "",
  accessInstructions: "",
  gateCode: "",
  parkingInstructions: "",
  petNotes: "",
  bedrooms: 2,
  bathrooms: 1,
  extraRooms: 0,
  cleaningIntensity: "standard",
  equipmentSupply: "customer",
  requestedTeamSize: 1,
  propertySizeSqm: null,
  officeSizeTier: null,
  officeWorkstations: null,
  frequency: "once",
  addons: [],
  carpetStainSeverity: null,
  carpetPetStains: false,
  carpetGoodDryingAirflow: false,
  specialInstructions: "",
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

export { buildAdminDraftPricingInput };

export function buildAdminDraftRequestBody(
  state: AdminBookingWizardFormState,
  idempotencyKey: string,
) {
  const slot = buildWizardSlot(state.date, state.time);
  const pricingInput = buildAdminDraftPricingInput(state);
  if (!slot || !pricingInput || !state.serviceSlug) {
    return null;
  }

  const address = buildAdminDraftAddressPayload(state);

  return {
    customerId: state.customerId.trim(),
    idempotencyKey,
    scheduledStart: slot.scheduledStart,
    scheduledEnd: slot.scheduledEnd,
    pricingInput,
    address: {
      addressLine1: address.addressLine1,
      suburb: address.suburb,
      city: address.city,
      locationNotes: address.locationNotes,
      specialInstructions: address.specialInstructions,
    },
    cleanerPreferenceMode: "best_available" as const,
  };
}

export type { PricingInput };
