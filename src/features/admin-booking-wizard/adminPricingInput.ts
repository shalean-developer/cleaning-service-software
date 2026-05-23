import { serviceSupportsExtraRooms } from "@/features/pricing/server/catalog";
import { deriveOfficePropertySizeSqm } from "@/features/booking-wizard/officeSizing";
import { isOfficeCleaningSlug } from "@/features/booking-wizard/officeCleaningDisplay";
import type { PricingInput } from "@/features/pricing/server/types";
import type { AdminBookingWizardFormState } from "./draftFormState";
import { resolveAdminPricingFrequency } from "./adminRecurringSchedule";

function resolveAdminPropertySizeSqm(state: AdminBookingWizardFormState): number | null | undefined {
  if (!state.serviceSlug || !isOfficeCleaningSlug(state.serviceSlug)) {
    return state.propertySizeSqm;
  }
  return (
    deriveOfficePropertySizeSqm(state.officeSizeTier, state.officeWorkstations) ??
    state.propertySizeSqm
  );
}

/** Mirrors customer `wizardStateToPricingInput` for admin-assisted draft quotes. */
export function buildAdminDraftPricingInput(
  state: AdminBookingWizardFormState,
): PricingInput | null {
  if (!state.serviceSlug) return null;

  return {
    serviceSlug: state.serviceSlug,
    bedrooms: state.bedrooms,
    bathrooms: state.bathrooms,
    extraRooms:
      state.serviceSlug && serviceSupportsExtraRooms(state.serviceSlug) ? state.extraRooms : 0,
    cleaningIntensity:
      state.serviceSlug === "regular-cleaning" ? state.cleaningIntensity : "standard",
    equipmentSupply:
      state.serviceSlug === "regular-cleaning" ? state.equipmentSupply : "customer",
    propertySizeSqm: resolveAdminPropertySizeSqm(state),
    frequency: resolveAdminPricingFrequency({
      frequency: state.frequency,
      recurringIntervalWeeks: state.recurringIntervalWeeks,
    }),
    addons: state.addons.length > 0 ? state.addons : undefined,
    teamSize: 1,
    requestedTeamSize: state.serviceSlug === "regular-cleaning" ? state.requestedTeamSize : 1,
  };
}
