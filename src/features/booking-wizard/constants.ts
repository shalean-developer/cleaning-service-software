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
  "airbnb-cleaning": "Guest-ready turnaround",
  "office-cleaning": "Commercial spaces — size may apply",
  "carpet-cleaning": "Carpet zones per room",
};

/** Step 1 desktop card copy — max two lines; display only. */
export const SERVICE_STEP_DESCRIPTIONS_DESKTOP: Record<ServiceSlug, string> = {
  "regular-cleaning": "Routine clean for kitchens, bathrooms, and living areas.",
  "deep-cleaning": "Deep clean for buildup, corners, and high-traffic areas.",
  "moving-cleaning": "Move-in or move-out clean for floors and surfaces.",
  "airbnb-cleaning": "Guest-ready clean for kitchens, baths, and key spaces.",
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
  "laundry",
  "interior-windows",
  "inside-fridge",
  "inside-oven",
  "balcony",
];

/** Step 4 add-on subtitles — display only; does not affect pricing. */
export const ADDON_STEP_DESCRIPTIONS: Record<AddonSlug, string> = {
  laundry: "Wash, dry, fold — agreed load size on site.",
  "interior-windows": "Accessible interior glass per window group.",
  "inside-fridge": "Shelves and drawers refreshed.",
  "inside-oven": "Racks, glass, interior degrease.",
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
    label: "Request 2 cleaners",
    description: "+R200 request surcharge — team availability confirmed after payment",
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
    description: "Normal routine clean — no extra charge",
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "Extra attention where needed — +15%",
  },
  {
    value: "heavy",
    label: "Heavy",
    description: "High-use home, deeper attention — +30% (still regular cleaning)",
  },
];

export const FREQUENCY_STEP_OPTIONS: FrequencyStepOption[] = [
  { value: "once", label: "Once-off", description: "Single scheduled visit" },
  { value: "weekly", label: "Weekly", description: "Best value" },
  { value: "biweekly", label: "Bi-weekly", description: "Popular" },
  { value: "monthly", label: "Monthly", description: "Recurring monthly cadence" },
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
