import type { ServiceSlug } from "@/features/pricing/server/types";
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
> {
  return {
    serviceSlug: slug,
    bedrooms: slug === "office-cleaning" ? 0 : 2,
    bathrooms: slug === "office-cleaning" ? 0 : 1,
    extraRooms: 0,
    cleaningIntensity: "standard",
    equipmentSupply: "customer",
    requestedTeamSize: 1,
  };
}

export function applyServiceSelectionToWizardState(
  state: BookingWizardState,
  slug: ServiceSlug,
): BookingWizardState {
  return { ...state, ...wizardPatchForServiceSelection(slug) };
}
