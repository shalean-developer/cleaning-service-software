/**
 * Deep Cleaning and Move In/Out Cleaning add-on presentation.
 * Display-only — slugs must exist in `ADDON_CATALOG`.
 */

import type { AddonSlug } from "@/features/pricing/server/types";

/** Deep / move add-on row order — display only. */
export const DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER: AddonSlug[] = [
  "balcony",
  "carpet-addon",
  "ceiling-cleaning",
  "garage-cleaning",
  "mattress-cleaning",
  "outside-windows",
  "couch-cleaning",
];

export const DEEP_MOVING_ADDON_STEP_LABELS: Partial<Record<AddonSlug, string>> = {
  balcony: "Balcony cleaning",
  "carpet-addon": "Carpet cleaning",
  "ceiling-cleaning": "Ceiling cleaning",
  "garage-cleaning": "Garage cleaning",
  "mattress-cleaning": "Mattress cleaning",
  "outside-windows": "Outside windows",
  "couch-cleaning": "Couch cleaning",
};

export const DEEP_MOVING_ADDON_STEP_DESCRIPTIONS: Partial<Record<AddonSlug, string>> = {
  balcony: "Balcony sweep and outdoor surfaces — common for seasonal resets and handover.",
  "carpet-addon": "Room carpet refresh — stain lift and traffic-area attention.",
  "ceiling-cleaning": "Accessible ceiling surfaces — cobwebs, dust, and buildup at height.",
  "garage-cleaning": "Garage floor sweep and surface tidy before move-in or handover.",
  "mattress-cleaning": "Deep clean for one mattress — stain lift and fabric refresh.",
  "outside-windows": "Exterior glass and frames where safely reachable from ground level.",
  "couch-cleaning": "Upholstery refresh for one couch or sofa — fabric-safe clean.",
};
