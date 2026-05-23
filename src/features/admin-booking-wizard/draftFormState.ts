import { buildWizardSlot } from "@/features/booking-wizard/slot";
import { showFrequencyForService } from "@/features/booking-wizard/frequencyVisibility";
import type { CarpetStainSeverity } from "@/features/booking-wizard/carpetCleaningDisplay";
import type { OfficeSizeTier, OfficeWorkstationTier } from "@/features/booking-wizard/officeSizing";
import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  PricingInput,
  ServiceSlug,
} from "@/features/pricing/server/types";
import { buildAdminDraftAddressPayload } from "./adminAddressCompose";
import { buildAdminDraftPricingInput } from "./adminPricingInput";
import {
  buildAdminRecurringScheduleMetadata,
  validateAdminRecurringSchedule,
  type AdminBookingWizardFrequency,
} from "./adminRecurringSchedule";
import {
  DEFAULT_ADMIN_WIZARD_BILLING_MODE,
  type AdminWizardBillingMode,
  type AdminWizardCustomerBillingSnapshot,
} from "./adminBillingMode";

export type { AdminBookingWizardFrequency };

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
  frequency: AdminBookingWizardFrequency;
  recurringDays: number[];
  recurringIntervalWeeks: number;
  addons: AddonSlug[];
  carpetStainSeverity: CarpetStainSeverity | null;
  carpetPetStains: boolean;
  carpetGoodDryingAirflow: boolean;
  specialInstructions: string;
  billingMode: AdminWizardBillingMode;
  customerBillingAccount: AdminWizardCustomerBillingSnapshot | null;
  billingModeResetMessage: string | null;
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
  recurringDays: [],
  recurringIntervalWeeks: 1,
  addons: [],
  carpetStainSeverity: null,
  carpetPetStains: false,
  carpetGoodDryingAirflow: false,
  specialInstructions: "",
  billingMode: DEFAULT_ADMIN_WIZARD_BILLING_MODE,
  customerBillingAccount: null,
  billingModeResetMessage: null,
};

export function isAdminDraftFormReadyForSave(state: AdminBookingWizardFormState): boolean {
  if (!state.selectedCustomer?.customerId.trim()) return false;
  if (!state.customerId.trim()) return false;
  if (!state.serviceSlug) return false;
  if (!state.date.trim() || !state.time.trim()) return false;
  if (!state.addressLine1.trim() || !state.suburb.trim() || !state.city.trim()) return false;
  if (validateAdminRecurringSchedule(state)) return false;
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
  const recurringSchedule = showFrequencyForService(state.serviceSlug)
    ? buildAdminRecurringScheduleMetadata({
        frequency: state.frequency,
        recurringDays: state.recurringDays,
        recurringIntervalWeeks: state.recurringIntervalWeeks,
        scheduleDate: state.date,
      })
    : null;

  const billing =
    state.billingMode === "monthly_account" && state.customerBillingAccount?.accountId
      ? {
          mode: state.billingMode,
          monthlyAccountId: state.customerBillingAccount.accountId,
          zohoCustomerId: state.customerBillingAccount.zohoCustomerId ?? undefined,
          billingEmail: state.customerBillingAccount.billingEmail ?? undefined,
          billingTerms: state.customerBillingAccount.billingTerms ?? undefined,
        }
      : { mode: state.billingMode };

  return {
    customerId: state.customerId.trim(),
    idempotencyKey,
    scheduledStart: slot.scheduledStart,
    scheduledEnd: slot.scheduledEnd,
    pricingInput,
    ...(recurringSchedule ? { recurringSchedule } : {}),
    address: {
      addressLine1: address.addressLine1,
      suburb: address.suburb,
      city: address.city,
      locationNotes: address.locationNotes,
      specialInstructions: address.specialInstructions,
    },
    cleanerPreferenceMode: "best_available" as const,
    billing,
  };
}

export type { PricingInput };
