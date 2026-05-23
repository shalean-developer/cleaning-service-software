import type { ServiceSlug } from "@/features/pricing/server/types";
import { getAddonStepDisplayOrder } from "@/features/booking-wizard/addonStepDisplay";
import { cadenceResetPatchForService } from "@/features/booking-wizard/frequencyVisibility";
import { wizardPatchForServiceSelection } from "@/features/booking-wizard/serviceSelection";
import type { AdminBookingWizardFormState } from "./draftFormState";

/** Reset service-specific fields when admin changes service (mirrors customer wizard). */
export function applyAdminServiceSelection(
  state: AdminBookingWizardFormState,
  slug: ServiceSlug,
): AdminBookingWizardFormState {
  const patch = wizardPatchForServiceSelection(slug);
  const allowedAddons = new Set(getAddonStepDisplayOrder(slug));
  const addons = state.addons.filter((addon) => allowedAddons.has(addon));
  const cadenceReset = cadenceResetPatchForService(slug);

  return {
    ...state,
    serviceSlug: slug,
    bedrooms: patch.bedrooms,
    bathrooms: patch.bathrooms,
    extraRooms: patch.extraRooms,
    cleaningIntensity: patch.cleaningIntensity,
    equipmentSupply: patch.equipmentSupply,
    requestedTeamSize: patch.requestedTeamSize,
    carpetStainSeverity: patch.carpetStainSeverity,
    carpetPetStains: patch.carpetPetStains,
    carpetGoodDryingAirflow: patch.carpetGoodDryingAirflow,
    officeSizeTier: patch.officeSizeTier,
    officeWorkstations: patch.officeWorkstations,
    propertySizeSqm: patch.propertySizeSqm,
    frequency: cadenceReset?.frequency ?? state.frequency,
    recurringDays: cadenceReset?.recurringDays ?? state.recurringDays,
    recurringIntervalWeeks: cadenceReset ? 1 : state.recurringIntervalWeeks,
    addons,
  };
}
