import { ADDON_CATALOG } from "@/features/pricing/server/catalog";
import type { AddonSlug, ServiceSlug } from "@/features/pricing/server/types";
import {
  AIRBNB_ADDON_STEP_DESCRIPTIONS,
  AIRBNB_ADDON_STEP_DISPLAY_ORDER,
  AIRBNB_ADDON_STEP_LABELS,
  isAirbnbCleaningSlug,
} from "./airbnbCleaningDisplay";
import {
  DEEP_ADDON_STEP_DESCRIPTIONS,
  DEEP_ADDON_STEP_DISPLAY_ORDER,
  DEEP_ADDON_STEP_LABELS,
  isDeepCleaningSlug,
} from "./deepCleaningDisplay";
import {
  CARPET_ADDON_STEP_DESCRIPTIONS,
  CARPET_ADDON_STEP_DISPLAY_ORDER,
  CARPET_ADDON_STEP_LABELS,
  isCarpetCleaningSlug,
} from "./carpetCleaningDisplay";
import {
  isMovingCleaningSlug,
  MOVING_ADDON_STEP_DESCRIPTIONS,
  MOVING_ADDON_STEP_DISPLAY_ORDER,
  MOVING_ADDON_STEP_LABELS,
} from "./movingCleaningDisplay";
import {
  isOfficeCleaningSlug,
  OFFICE_ADDON_STEP_DESCRIPTIONS,
  OFFICE_ADDON_STEP_DISPLAY_ORDER,
  OFFICE_ADDON_STEP_LABELS,
} from "./officeCleaningDisplay";
import {
  ADDON_STEP_DESCRIPTIONS,
  ADDON_STEP_DISPLAY_ORDER,
  REGULAR_CLEANING_ADDON_STEP_DISPLAY_ORDER,
  REGULAR_CLEANING_ADDON_STEP_LABELS,
} from "./constants";

/** Step 4 add-on row order. display only; slugs must exist in `ADDON_CATALOG`. */
export function getAddonStepDisplayOrder(serviceSlug: ServiceSlug | null): AddonSlug[] {
  if (serviceSlug === "regular-cleaning") {
    return REGULAR_CLEANING_ADDON_STEP_DISPLAY_ORDER;
  }
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return AIRBNB_ADDON_STEP_DISPLAY_ORDER;
  }
  if (isOfficeCleaningSlug(serviceSlug)) {
    return OFFICE_ADDON_STEP_DISPLAY_ORDER;
  }
  if (isMovingCleaningSlug(serviceSlug)) {
    return MOVING_ADDON_STEP_DISPLAY_ORDER;
  }
  if (isDeepCleaningSlug(serviceSlug)) {
    return DEEP_ADDON_STEP_DISPLAY_ORDER;
  }
  if (isCarpetCleaningSlug(serviceSlug)) {
    return CARPET_ADDON_STEP_DISPLAY_ORDER;
  }
  return ADDON_STEP_DISPLAY_ORDER;
}

/** Step 4 / review add-on label. display only; does not affect pricing or payloads. */
export function getAddonStepLabel(slug: AddonSlug, serviceSlug: ServiceSlug | null): string {
  if (serviceSlug === "regular-cleaning") {
    return REGULAR_CLEANING_ADDON_STEP_LABELS[slug] ?? ADDON_CATALOG[slug].label;
  }
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return AIRBNB_ADDON_STEP_LABELS[slug] ?? ADDON_CATALOG[slug].label;
  }
  if (isOfficeCleaningSlug(serviceSlug)) {
    return OFFICE_ADDON_STEP_LABELS[slug] ?? ADDON_CATALOG[slug].label;
  }
  if (isMovingCleaningSlug(serviceSlug)) {
    return MOVING_ADDON_STEP_LABELS[slug] ?? ADDON_CATALOG[slug].label;
  }
  if (isDeepCleaningSlug(serviceSlug)) {
    return DEEP_ADDON_STEP_LABELS[slug] ?? ADDON_CATALOG[slug].label;
  }
  if (isCarpetCleaningSlug(serviceSlug)) {
    return CARPET_ADDON_STEP_LABELS[slug] ?? ADDON_CATALOG[slug].label;
  }
  return ADDON_CATALOG[slug].label;
}

/** Step 4 add-on subtitle. display only. */
export function getAddonStepDescription(slug: AddonSlug, serviceSlug: ServiceSlug | null): string {
  if (isAirbnbCleaningSlug(serviceSlug) && AIRBNB_ADDON_STEP_DESCRIPTIONS[slug]) {
    return AIRBNB_ADDON_STEP_DESCRIPTIONS[slug]!;
  }
  if (isOfficeCleaningSlug(serviceSlug) && OFFICE_ADDON_STEP_DESCRIPTIONS[slug]) {
    return OFFICE_ADDON_STEP_DESCRIPTIONS[slug]!;
  }
  if (isMovingCleaningSlug(serviceSlug) && MOVING_ADDON_STEP_DESCRIPTIONS[slug]) {
    return MOVING_ADDON_STEP_DESCRIPTIONS[slug]!;
  }
  if (isDeepCleaningSlug(serviceSlug) && DEEP_ADDON_STEP_DESCRIPTIONS[slug]) {
    return DEEP_ADDON_STEP_DESCRIPTIONS[slug]!;
  }
  if (isCarpetCleaningSlug(serviceSlug) && CARPET_ADDON_STEP_DESCRIPTIONS[slug]) {
    return CARPET_ADDON_STEP_DESCRIPTIONS[slug]!;
  }
  return ADDON_STEP_DESCRIPTIONS[slug];
}
