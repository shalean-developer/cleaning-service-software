import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";
import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  PricingFrequency,
  ServiceSlug,
} from "@/features/pricing/server/types";

export const WIZARD_TIMEZONE = "Africa/Johannesburg";
export const WIZARD_JOB_DURATION_MINUTES = 180;
export const WIZARD_STORAGE_KEY = "shalean-booking-wizard-v1";

export type WizardServiceOption = {
  slug: ServiceSlug;
  label: string;
  description: string;
  enabled: boolean;
};

/** Step 1 mobile card copy — short lines; does not affect pricing or validation. */
const SERVICE_STEP_DESCRIPTIONS: Record<ServiceSlug, string> = {
  "regular-cleaning": "Routine upkeep for your home",
  "deep-cleaning": "Detailed top-to-bottom clean",
  "moving-cleaning": "Move-in or move-out reset",
  "airbnb-cleaning": "Guest-ready turnover",
  "office-cleaning": "Commercial spaces — size may apply",
  "carpet-cleaning": "Carpet zones per room",
};

/** Step 1 desktop card copy — max two lines; display only. */
export const SERVICE_STEP_DESCRIPTIONS_DESKTOP: Record<ServiceSlug, string> = {
  "regular-cleaning": "Routine clean for kitchens, bathrooms, and living areas.",
  "deep-cleaning": "Deep clean for buildup, corners, and high-traffic areas.",
  "moving-cleaning": "Move-in or move-out clean for floors and surfaces.",
  "airbnb-cleaning":
    "Fast, detail-focused property preparation before your next guest check-in.",
  "office-cleaning": "Commercial office clean; workspace size may apply.",
  "carpet-cleaning": "Carpet and rug clean by room or zone you choose.",
};

/** Step 4 frequency cards — display only; values must match `PRICING_FREQUENCIES`. */
export type FrequencyStepOption = {
  value: PricingFrequency;
  label: string;
  description: string;
};

/** Step 4 add-on list order — display only; slugs must exist in `ADDON_CATALOG`. */
export const ADDON_STEP_DISPLAY_ORDER: AddonSlug[] = [
  "inside-cabinets",
  "inside-oven",
  "inside-fridge",
  "interior-walls",
  "laundry",
  "interior-windows",
  "balcony",
];

/** Regular cleaning step 4 add-ons — display order matches product spec. */
export const REGULAR_CLEANING_ADDON_STEP_DISPLAY_ORDER: AddonSlug[] = [
  "inside-cabinets",
  "inside-oven",
  "inside-fridge",
  "interior-walls",
  "laundry",
  "interior-windows",
];

/** Regular cleaning step 4 labels — display only; slug IDs unchanged. */
export const REGULAR_CLEANING_ADDON_STEP_LABELS: Partial<Record<AddonSlug, string>> = {
  laundry: "Ironing & Laundry",
};

/** Step 4 add-on subtitles — display only; does not affect pricing. */
export const ADDON_STEP_DESCRIPTIONS: Record<AddonSlug, string> = {
  "inside-cabinets": "Cupboard and cabinet interiors wiped down.",
  "inside-fridge": "Shelves and drawers refreshed.",
  "inside-oven": "Racks, glass, interior degrease.",
  "interior-walls": "Spot-clean marks on accessible interior walls.",
  "interior-windows": "Accessible interior glass per window group.",
  laundry: "Wash, dry, fold — agreed load size on site.",
  balcony: "Outdoor balcony sweep and surface tidy.",
};

/** Step 4 cleaning intensity — regular cleaning only; values match `CLEANING_INTENSITIES`. */
export type CleaningIntensityStepOption = {
  value: CleaningIntensity;
  label: string;
  description: string;
};

/** Step 4 equipment supply — regular cleaning only; values match `EQUIPMENT_SUPPLY_OPTIONS`. */
export type EquipmentSupplyStepOption = {
  value: EquipmentSupply;
  label: string;
  description: string;
};

export type TeamSupportStepOption = {
  value: 1 | 2;
  label: string;
  description: string;
};

export const TEAM_SUPPORT_STEP_OPTIONS: TeamSupportStepOption[] = [
  {
    value: 1,
    label: "1 cleaner",
    description: "Standard visit for most homes",
  },
  {
    value: 2,
    label: "Request team support",
    description: "+R200 request surcharge — we'll confirm team availability after payment",
  },
];

export const EQUIPMENT_SUPPLY_STEP_OPTIONS: EquipmentSupplyStepOption[] = [
  {
    value: "customer",
    label: "I have cleaning supplies",
    description: "No extra charge — you provide supplies and equipment",
  },
  {
    value: "shalean",
    label: "Bring cleaning equipment",
    description: "+R100 — cleaner arrives with Shalean supplies and equipment",
  },
];

export const CLEANING_INTENSITY_STEP_OPTIONS: CleaningIntensityStepOption[] = [
  {
    value: "standard",
    label: "Standard",
    description: "Normal routine clean",
  },
  {
    value: "detailed",
    label: "Heavy use",
    description: "+15%",
  },
  {
    value: "heavy",
    label: "Post-event / extra dirty",
    description: "+30%",
  },
];

export const FREQUENCY_STEP_OPTIONS: FrequencyStepOption[] = [
  { value: "once", label: "Once-off", description: "One visit" },
  { value: "weekly", label: "Weekly", description: "Best for routine upkeep" },
  { value: "biweekly", label: "Bi-weekly", description: "Every 2 weeks" },
  { value: "monthly", label: "Monthly", description: "Light maintenance" },
];

export const WIZARD_SERVICE_OPTIONS: WizardServiceOption[] = (
  [
    "regular-cleaning",
    "deep-cleaning",
    "moving-cleaning",
    "airbnb-cleaning",
    "office-cleaning",
    "carpet-cleaning",
  ] as const
).map((slug) => ({
  slug,
  label: SERVICE_CATALOG[slug].label,
  description: SERVICE_STEP_DESCRIPTIONS[slug],
  enabled: true,
}));

export const WIZARD_STEP_LABELS: Record<string, string> = {
  service: "Service",
  datetime: "Schedule",
  location: "Location",
  details: "Details",
  cleaner: "Cleaner",
  review: "Review",
  checkout: "Checkout",
};

/** Compact labels for narrow mobile stepper chips. */
export const WIZARD_STEP_SHORT_LABELS: Record<string, string> = {
  service: "Service",
  datetime: "Date",
  location: "Place",
  details: "Details",
  cleaner: "Cleaner",
  review: "Review",
  checkout: "Pay",
};
