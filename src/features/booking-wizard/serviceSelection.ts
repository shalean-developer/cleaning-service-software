import type { ServiceSlug } from "@/features/pricing/server/types";
import { cadenceResetPatchForService } from "./frequencyVisibility";
import { mergeWithQuoteInvalidation } from "./quoteInvalidation";
import type { BookingWizardState } from "./types";

/** Same bedroom/bathroom defaults as tapping a service on step 1. */
export function wizardPatchForServiceSelection(
  slug: ServiceSlug,
): Pick<
  BookingWizardState,
  | "serviceSlug"
  | "bedrooms"
  | "bathrooms"
  | "extraRooms"
  | "cleaningIntensity"
  | "equipmentSupply"
  | "requestedTeamSize"
  | "carpetStainSeverity"
  | "carpetPetStains"
  | "carpetGoodDryingAirflow"
  | "addons"
  | "officeSizeTier"
  | "officeWorkstations"
  | "propertySizeSqm"
  | "addons"
> &
  Partial<Pick<BookingWizardState, "frequency" | "recurringDays">> {
  const cadenceReset = cadenceResetPatchForService(slug);
  return {
    serviceSlug: slug,
    bedrooms: slug === "office-cleaning" ? 0 : 2,
    bathrooms: slug === "office-cleaning" ? 0 : 1,
    extraRooms: 0,
    officeSizeTier: null,
    officeWorkstations: null,
    propertySizeSqm: null,
    cleaningIntensity: "standard",
    equipmentSupply: "customer",
    requestedTeamSize: 1,
    carpetStainSeverity: null,
    carpetPetStains: false,
    carpetGoodDryingAirflow: false,
    addons: [],
    ...(cadenceReset ?? {}),
  };
}

export function applyServiceSelectionToWizardState(
  state: BookingWizardState,
  slug: ServiceSlug,
): BookingWizardState {
  const partial = wizardPatchForServiceSelection(slug);
  return { ...state, ...mergeWithQuoteInvalidation(state, partial) };
}
