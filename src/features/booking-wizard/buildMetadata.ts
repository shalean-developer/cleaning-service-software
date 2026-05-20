import { buildBookingQuoteMetadata } from "@/features/pricing/server/metadata";
import type { PricingBreakdown, PricingInput } from "@/features/pricing/server/types";
import { normalizeAreaSlug } from "@/features/cleaners/server/eligibility/normalize";
import {
  buildCarpetBookingDetailsMetadata,
  isCarpetCleaningSlug,
} from "./carpetCleaningDisplay";
import { resolveContactPhoneForMetadata } from "./contactPhone";
import type { BookingWizardState } from "./types";

export function wizardStateToPricingInput(state: BookingWizardState): PricingInput | null {
  if (!state.serviceSlug) return null;

  return {
    serviceSlug: state.serviceSlug,
    bedrooms: state.bedrooms,
    bathrooms: state.bathrooms,
    extraRooms: state.serviceSlug === "regular-cleaning" ? state.extraRooms : 0,
    cleaningIntensity:
      state.serviceSlug === "regular-cleaning" ? state.cleaningIntensity : "standard",
    equipmentSupply:
      state.serviceSlug === "regular-cleaning" ? state.equipmentSupply : "customer",
    propertySizeSqm: state.propertySizeSqm,
    frequency: state.frequency,
    addons: state.addons.length > 0 ? state.addons : undefined,
    teamSize: 1,
    requestedTeamSize:
      state.serviceSlug === "regular-cleaning" ? state.requestedTeamSize : 1,
  };
}

export function buildWizardBookingMetadata(
  state: BookingWizardState,
  quote: PricingBreakdown,
): Record<string, unknown> {
  const pricingInput = wizardStateToPricingInput(state)!;
  const quoteMeta = buildBookingQuoteMetadata(pricingInput, quote);
  const contactPhone = resolveContactPhoneForMetadata(state);

  const carpetDetails = isCarpetCleaningSlug(state.serviceSlug)
    ? buildCarpetBookingDetailsMetadata({
        stainSeverity: state.carpetStainSeverity,
        petStains: state.carpetPetStains,
        goodDryingAirflow: state.carpetGoodDryingAirflow,
      })
    : null;

  return {
    ...quoteMeta,
    ...(carpetDetails ? { carpetDetails } : {}),
    ...(contactPhone ? { contactPhone } : {}),
    areaSlug: normalizeAreaSlug(state.suburb),
    suburb: state.suburb.trim(),
    city: state.city.trim(),
    address: {
      line1: state.addressLine1.trim(),
      suburb: state.suburb.trim(),
      city: state.city.trim(),
      notes: state.locationNotes.trim() || null,
    },
    specialInstructions: state.specialInstructions.trim() || null,
    preferred_cleaner_id:
      state.cleanerPreferenceMode === "selected" ? state.selectedCleanerId : null,
    cleanerPreferenceMode: state.cleanerPreferenceMode,
    timezone: "Africa/Johannesburg",
  };
}
