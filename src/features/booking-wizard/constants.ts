import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";
import {
  DEEP_SERVICE_STEP_DESCRIPTION_DESKTOP,
  DEEP_SERVICE_STEP_DESCRIPTION_MOBILE,
} from "./deepCleaningDisplay";
import {
  MOVING_SERVICE_STEP_DESCRIPTION_DESKTOP,
  MOVING_SERVICE_STEP_DESCRIPTION_MOBILE,
} from "./movingCleaningDisplay";
import {
  CARPET_SERVICE_STEP_DESCRIPTION_DESKTOP,
  CARPET_SERVICE_STEP_DESCRIPTION_MOBILE,
} from "./carpetCleaningDisplay";
import {
  OFFICE_SERVICE_STEP_DESCRIPTION_DESKTOP,
  OFFICE_SERVICE_STEP_DESCRIPTION_MOBILE,
} from "./officeCleaningDisplay";
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
  "regular-cleaning": "Routine kitchens, bathrooms, and living areas",
  "deep-cleaning": DEEP_SERVICE_STEP_DESCRIPTION_MOBILE,
  "moving-cleaning": MOVING_SERVICE_STEP_DESCRIPTION_MOBILE,
  "airbnb-cleaning": "Fast prep before your next guest",
  "office-cleaning": OFFICE_SERVICE_STEP_DESCRIPTION_MOBILE,
  "carpet-cleaning": CARPET_SERVICE_STEP_DESCRIPTION_MOBILE,
};

/** Step 1 desktop card copy — max two lines; display only. */
export const SERVICE_STEP_DESCRIPTIONS_DESKTOP: Record<ServiceSlug, string> = {
  "regular-cleaning":
    "Routine cleaning for kitchens, bathrooms, and living spaces.",
  "deep-cleaning": DEEP_SERVICE_STEP_DESCRIPTION_DESKTOP,
  "moving-cleaning": MOVING_SERVICE_STEP_DESCRIPTION_DESKTOP,
  "airbnb-cleaning":
    "Fast property preparation before your next guest check-in.",
  "office-cleaning": OFFICE_SERVICE_STEP_DESCRIPTION_DESKTOP,
  "carpet-cleaning": CARPET_SERVICE_STEP_DESCRIPTION_DESKTOP,
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
  "mattress-cleaning": "Deep clean for one mattress — stain lift and fabric refresh.",
  "carpet-addon": "Room carpet refresh — stain lift and traffic-area attention.",
  "ceiling-cleaning": "Accessible ceiling surfaces — dust and cobwebs at height.",
  "garage-cleaning": "Garage floor sweep and surface tidy.",
  "outside-windows": "Exterior glass and frames where safely reachable.",
  "couch-cleaning": "Upholstery refresh for one couch or sofa.",
  "restocking-assistance": "Help restock guest essentials and consumables.",
  "patio-outdoor-sweep": "Patio and outdoor areas swept for guest arrival.",
  "same-day-urgent-turnaround": "Priority turnover support between guest bookings.",
  "boardroom-detailing": "Meeting room surfaces, tables, and presentation areas detailed.",
  "kitchenette-cleaning": "Staff kitchenette counters, sink, and surfaces refreshed.",
  "carpet-spot-cleaning": "Targeted carpet spotting in office traffic areas.",
  "sanitization-treatment": "High-touch surface disinfection for shared workspaces.",
  "waste-removal": "Bins emptied and liners refreshed in shared areas.",
  "after-hours-cleaning": "Cleaning scheduled outside standard office hours.",
  "rug-cleaning": "Area rug refresh — stain lift and pile revitalization.",
  "stain-treatment": "Targeted stain lifting for high-traffic or marked areas.",
  "deodorizing-treatment": "Odor neutralization for fabrics and carpeted areas.",
  "fabric-protection": "Protective treatment to help reduce future staining.",
  "upholstery-refresh": "Light upholstery clean for chairs and fabric seating.",
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
  {
    value: "weekly",
    label: "Weekly",
    description: "First-booking preference — follow-ups arranged after",
  },
  {
    value: "biweekly",
    label: "Bi-weekly",
    description: "First-booking preference — follow-ups arranged after",
  },
  {
    value: "monthly",
    label: "Monthly",
    description: "First-booking preference — follow-ups arranged after",
  },
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
  label:
    slug === "moving-cleaning" ? "Move In/Out Cleaning" : SERVICE_CATALOG[slug].label,
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
