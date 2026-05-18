import { buildWizardBookingMetadata, wizardStateToPricingInput } from "./buildMetadata";
import { buildWizardSlot } from "./slot";
import type { BookingWizardState } from "./types";
import type { PricingBreakdown } from "@/features/pricing/server/types";
import { normalizeAreaSlug } from "@/features/cleaners/server/eligibility/normalize";

export type LockRequestBody = {
  checkoutIdempotencyKey: string;
  clientQuoteTotalCents: number;
  serviceSlug: string;
  bedrooms: number;
  bathrooms: number;
  extraRooms: number;
  cleaningIntensity: string;
  equipmentSupply: string;
  requestedTeamSize: number;
  propertySizeSqm: number | null;
  frequency: string;
  addons: string[];
  scheduledStart: string;
  scheduledEnd: string;
  suburb: string;
  areaSlug: string;
  cleanerPreferenceMode: string;
  selectedCleanerId: string | null;
  bookingMetadata: Record<string, unknown>;
};

export type LockRequestPayloadResult = LockRequestBody | { error: string };

export function buildLockRequestPayload(
  state: BookingWizardState,
  quote: PricingBreakdown,
  checkoutIdempotencyKey: string,
): LockRequestPayloadResult {
  const pricingInput = wizardStateToPricingInput(state);
  if (!pricingInput) {
    return { error: "Missing service selection." };
  }

  const slot = buildWizardSlot(state.date, state.time);
  if (!slot) {
    return { error: "Invalid date or time." };
  }

  if (!state.serviceSlug) {
    return { error: "Missing service selection." };
  }

  return {
    checkoutIdempotencyKey,
    clientQuoteTotalCents: quote.totalCents,
    serviceSlug: state.serviceSlug,
    bedrooms: state.bedrooms,
    bathrooms: state.bathrooms,
    extraRooms: state.serviceSlug === "regular-cleaning" ? state.extraRooms : 0,
    cleaningIntensity:
      state.serviceSlug === "regular-cleaning" ? state.cleaningIntensity : "standard",
    equipmentSupply:
      state.serviceSlug === "regular-cleaning" ? state.equipmentSupply : "customer",
    requestedTeamSize:
      state.serviceSlug === "regular-cleaning" ? state.requestedTeamSize : 1,
    propertySizeSqm: state.propertySizeSqm,
    frequency: state.frequency,
    addons: state.addons,
    scheduledStart: slot.scheduledStart,
    scheduledEnd: slot.scheduledEnd,
    suburb: state.suburb,
    areaSlug: normalizeAreaSlug(state.suburb),
    cleanerPreferenceMode: state.cleanerPreferenceMode,
    selectedCleanerId:
      state.cleanerPreferenceMode === "selected" ? state.selectedCleanerId : null,
    bookingMetadata: buildWizardBookingMetadata(state, quote),
  };
}

export const LOCK_REFRESH_ERRORS = new Set([
  "QUOTE_MISMATCH",
  "LOCK_EXPIRED",
  "LOCK_INPUT_MISMATCH",
]);

export function shouldReturnToReview(errorCode: string): boolean {
  return LOCK_REFRESH_ERRORS.has(errorCode);
}
