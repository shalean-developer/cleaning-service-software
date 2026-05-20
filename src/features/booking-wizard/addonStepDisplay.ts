import { ADDON_CATALOG } from "@/features/pricing/server/catalog";
import type { AddonSlug, ServiceSlug } from "@/features/pricing/server/types";
import {
  AIRBNB_ADDON_STEP_DESCRIPTIONS,
  AIRBNB_ADDON_STEP_DISPLAY_ORDER,
  AIRBNB_ADDON_STEP_LABELS,
  isAirbnbCleaningSlug,
} from "./airbnbCleaningDisplay";
import {
  ADDON_STEP_DESCRIPTIONS,
  ADDON_STEP_DISPLAY_ORDER,
  REGULAR_CLEANING_ADDON_STEP_DISPLAY_ORDER,
  REGULAR_CLEANING_ADDON_STEP_LABELS,
} from "./constants";

/** Step 4 add-on row order — display only; slugs must exist in `ADDON_CATALOG`. */
export function getAddonStepDisplayOrder(serviceSlug: ServiceSlug | null): AddonSlug[] {
  if (serviceSlug === "regular-cleaning") {
    return REGULAR_CLEANING_ADDON_STEP_DISPLAY_ORDER;
  }
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return AIRBNB_ADDON_STEP_DISPLAY_ORDER;
  }
  return ADDON_STEP_DISPLAY_ORDER;
}

/** Step 4 / review add-on label — display only; does not affect pricing or payloads. */
export function getAddonStepLabel(slug: AddonSlug, serviceSlug: ServiceSlug | null): string {
  if (serviceSlug === "regular-cleaning") {
    return REGULAR_CLEANING_ADDON_STEP_LABELS[slug] ?? ADDON_CATALOG[slug].label;
  }
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return AIRBNB_ADDON_STEP_LABELS[slug] ?? ADDON_CATALOG[slug].label;
  }
  return ADDON_CATALOG[slug].label;
}

/** Step 4 add-on subtitle — display only. */
export function getAddonStepDescription(slug: AddonSlug, serviceSlug: ServiceSlug | null): string {
  if (isAirbnbCleaningSlug(serviceSlug) && AIRBNB_ADDON_STEP_DESCRIPTIONS[slug]) {
    return AIRBNB_ADDON_STEP_DESCRIPTIONS[slug]!;
  }
  return ADDON_STEP_DESCRIPTIONS[slug];
}
