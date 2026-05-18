import { ADDON_CATALOG } from "@/features/pricing/server/catalog";
import type { AddonSlug, PricingFrequency, ServiceSlug } from "@/features/pricing/server/types";
import { ADDON_STEP_DISPLAY_ORDER, FREQUENCY_STEP_OPTIONS } from "./constants";
import type { CleanerPreferenceMode } from "./types";

export function getFrequencyLabel(frequency: PricingFrequency): string {
  return (
    FREQUENCY_STEP_OPTIONS.find((option) => option.value === frequency)?.label ?? frequency
  );
}

export function formatSelectedAddons(addons: AddonSlug[]): string {
  if (addons.length === 0) return "None";

  const ordered = ADDON_STEP_DISPLAY_ORDER.filter((slug) => addons.includes(slug));
  const labels = ordered.map((slug) => ADDON_CATALOG[slug].label);
  return labels.join(", ");
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
