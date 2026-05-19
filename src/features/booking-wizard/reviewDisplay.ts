import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  PricingFrequency,
  ServiceSlug,
} from "@/features/pricing/server/types";
import { getAddonStepDisplayOrder, getAddonStepLabel } from "./addonStepDisplay";
import {
  CLEANING_INTENSITY_STEP_OPTIONS,
  EQUIPMENT_SUPPLY_STEP_OPTIONS,
  FREQUENCY_STEP_OPTIONS,
} from "./constants";
import type { CleanerPreferenceMode } from "./types";

export function getFrequencyLabel(frequency: PricingFrequency): string {
  return (
    FREQUENCY_STEP_OPTIONS.find((option) => option.value === frequency)?.label ?? frequency
  );
}

function orderSelectedAddonSlugs(
  addons: AddonSlug[],
  serviceSlug: ServiceSlug | null,
): AddonSlug[] {
  const ordered = getAddonStepDisplayOrder(serviceSlug).filter((slug) => addons.includes(slug));
  const hidden = addons.filter((slug) => !ordered.includes(slug));
  return [...ordered, ...hidden];
}

export function getSelectedAddonLabels(
  addons: AddonSlug[],
  serviceSlug: ServiceSlug | null = null,
): string[] {
  return orderSelectedAddonSlugs(addons, serviceSlug).map((slug) =>
    getAddonStepLabel(slug, serviceSlug),
  );
}

export function formatSelectedAddons(
  addons: AddonSlug[],
  serviceSlug: ServiceSlug | null = null,
): string {
  if (addons.length === 0) return "None";

  return getSelectedAddonLabels(addons, serviceSlug).join(", ");
}

export function formatCompactBedBathSummary(
  serviceSlug: ServiceSlug | null,
  bedrooms: number,
  bathrooms: number,
  propertySizeSqm: number | null,
): string | null {
  const { bedroomsLabel, bathroomsLabel } = formatBedroomBathroomSummary(
    serviceSlug,
    bedrooms,
    bathrooms,
    propertySizeSqm,
  );

  if (serviceSlug === "office-cleaning") {
    return bathroomsLabel;
  }

  if (!bedroomsLabel || !bathroomsLabel) return null;

  const bedShort = bedrooms === 1 ? "1 bed" : `${bedrooms} beds`;
  const bathShort = bathrooms === 1 ? "1 bath" : `${bathrooms} baths`;
  return `${bedShort} · ${bathShort}`;
}

export function formatCleanerPreference(
  mode: CleanerPreferenceMode,
  displayName: string | null,
): string {
  if (mode === "best_available") return "Best available";
  return displayName ?? "Selected cleaner";
}

export function formatSuburbLocation(suburb: string, city: string): string {
  const parts = [suburb.trim(), city.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "\u2014";
}

export function getCleaningIntensityLabel(intensity: CleaningIntensity): string {
  return (
    CLEANING_INTENSITY_STEP_OPTIONS.find((option) => option.value === intensity)?.label ??
    intensity
  );
}

export function getCleaningIntensityExplanation(
  intensity: CleaningIntensity,
): string | null {
  if (intensity === "standard") return null;
  if (intensity === "detailed") {
    return "Extra attention for areas that need more time — still a regular clean, not a full deep clean.";
  }
  return "High-use home or rooms needing deeper attention — still regular cleaning with extra time, not a full deep clean.";
}

export function getEquipmentSupplyCustomerLabel(supply: EquipmentSupply): string {
  return supply === "shalean" ? "Shalean-provided" : "Customer-provided";
}

export function getEquipmentSupplyExplanation(supply: EquipmentSupply): string | null {
  if (supply !== "shalean") return null;
  return "Your cleaner will arrive with Shalean cleaning supplies and equipment.";
}

export function getEquipmentSupplyOperationalLabel(supply: EquipmentSupply): string {
  return supply === "shalean" ? "Bring cleaning equipment" : "Customer provides supplies";
}

export function getEquipmentSupplyStepLabel(supply: EquipmentSupply): string {
  return (
    EQUIPMENT_SUPPLY_STEP_OPTIONS.find((option) => option.value === supply)?.label ?? supply
  );
}

export function getTeamSupportCustomerLabel(requestedTeamSize: 1 | 2): string {
  return requestedTeamSize === 2 ? "Request 2 cleaners" : "1 cleaner";
}

export function getTeamSupportExplanation(requestedTeamSize: 1 | 2): string | null {
  if (requestedTeamSize !== 2) return null;
  return "We'll confirm team availability after payment.";
}

/** Neutral cleaner-facing note — not a team/dual-assignment label. */
export function getTeamSupportCleanerNote(requestedTeamSize: 1 | 2): string | null {
  if (requestedTeamSize !== 2) return null;
  return "Team support requested. Coordinate arrival with operations if needed.";
}

export function formatExtraRoomsSummary(extraRooms: number): string | null {
  if (extraRooms <= 0) return null;
  return `${extraRooms} extra room${extraRooms === 1 ? "" : "s"}`;
}

export function formatBedroomBathroomSummary(
  serviceSlug: ServiceSlug | null,
  bedrooms: number,
  bathrooms: number,
  propertySizeSqm: number | null,
): { bedroomsLabel: string | null; bathroomsLabel: string | null } {
  if (serviceSlug === "office-cleaning") {
    return {
      bedroomsLabel: null,
      bathroomsLabel:
        propertySizeSqm != null ? `${propertySizeSqm} sqm` : null,
    };
  }

  return {
    bedroomsLabel: `${bedrooms} bedroom${bedrooms === 1 ? "" : "s"}`,
    bathroomsLabel: `${bathrooms} bathroom${bathrooms === 1 ? "" : "s"}`,
  };
}
