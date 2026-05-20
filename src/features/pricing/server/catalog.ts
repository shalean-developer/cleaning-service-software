import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  PricingFrequency,
  ServiceSlug,
} from "./types";

/** All amounts are integer ZAR cents. */
export const FIXED_CLEANER_PAYOUT_CENTS = 25_000;
export const MIN_PERCENT_PAYOUT_CENTS = 25_000;
export const MAX_PERCENT_PAYOUT_CENTS = 30_000;

/** Flat fee when Shalean brings cleaning supplies/equipment (regular cleaning). */
export const CLEANING_EQUIPMENT_FEE_CENTS = 10_000;

/** Flat request surcharge when customer requests 2 cleaners (regular cleaning only; NF-7B). */
export const TEAM_SUPPORT_REQUEST_SURCHARGE_CENTS = 20_000;

export type ServicePricingRule = {
  slug: ServiceSlug;
  label: string;
  /** Included in base: 1 bedroom + 1 bathroom for residential-style services. */
  baseCents: number;
  extraBedroomCents: number;
  extraBathroomCents: number;
  /** Per additional non-bedroom/bathroom space (regular, deep, move in/out). */
  extraRoomCents?: number;
  /** When true, bedrooms/bathrooms may be 0 (office). */
  allowZeroRooms?: boolean;
  /** Per sqm over threshold (office). */
  propertySizePerSqmCents?: number;
  propertySizeFreeSqm?: number;
  /** Carpet: charge per bedroom zone instead of base+extras. */
  perBedroomCents?: number;
  /** Uses fixed R250/cleaner earnings (deep, moving, carpet). */
  fixedCleanerPayout?: boolean;
};

export const SERVICE_CATALOG: Record<ServiceSlug, ServicePricingRule> = {
  "regular-cleaning": {
    slug: "regular-cleaning",
    label: "Regular Cleaning",
    baseCents: 45_000,
    extraBedroomCents: 8_000,
    extraBathroomCents: 6_000,
    extraRoomCents: 7_000,
  },
  "deep-cleaning": {
    slug: "deep-cleaning",
    label: "Deep Cleaning",
    baseCents: 85_000,
    extraBedroomCents: 15_000,
    extraBathroomCents: 12_000,
    extraRoomCents: 7_000,
    fixedCleanerPayout: true,
  },
  "moving-cleaning": {
    slug: "moving-cleaning",
    label: "Moving Cleaning",
    baseCents: 120_000,
    extraBedroomCents: 20_000,
    extraBathroomCents: 15_000,
    extraRoomCents: 7_000,
    fixedCleanerPayout: true,
  },
  "airbnb-cleaning": {
    slug: "airbnb-cleaning",
    label: "Airbnb Cleaning",
    baseCents: 55_000,
    extraBedroomCents: 9_000,
    extraBathroomCents: 7_000,
  },
  "office-cleaning": {
    slug: "office-cleaning",
    label: "Office Cleaning",
    baseCents: 60_000,
    extraBedroomCents: 0,
    extraBathroomCents: 0,
    allowZeroRooms: true,
    propertySizePerSqmCents: 200,
    propertySizeFreeSqm: 50,
  },
  "carpet-cleaning": {
    slug: "carpet-cleaning",
    label: "Carpet Cleaning",
    baseCents: 40_000,
    extraBedroomCents: 0,
    extraBathroomCents: 0,
    perBedroomCents: 15_000,
    fixedCleanerPayout: true,
  },
};

export const ADDON_CATALOG: Record<
  AddonSlug,
  { slug: AddonSlug; label: string; amountCents: number }
> = {
  "inside-cabinets": {
    slug: "inside-cabinets",
    label: "Inside cabinets",
    amountCents: 12_000,
  },
  "inside-fridge": { slug: "inside-fridge", label: "Inside fridge", amountCents: 15_000 },
  "inside-oven": { slug: "inside-oven", label: "Inside oven", amountCents: 18_000 },
  "interior-walls": {
    slug: "interior-walls",
    label: "Interior walls",
    amountCents: 10_000,
  },
  "interior-windows": {
    slug: "interior-windows",
    label: "Interior windows",
    amountCents: 20_000,
  },
  laundry: { slug: "laundry", label: "Laundry", amountCents: 12_000 },
  balcony: { slug: "balcony", label: "Balcony cleaning", amountCents: 10_000 },
  "mattress-cleaning": {
    slug: "mattress-cleaning",
    label: "Mattress cleaning",
    amountCents: 24_000,
  },
  "carpet-addon": {
    slug: "carpet-addon",
    label: "Carpet cleaning",
    amountCents: 20_000,
  },
  "ceiling-cleaning": {
    slug: "ceiling-cleaning",
    label: "Ceiling cleaning",
    amountCents: 10_000,
  },
  "garage-cleaning": {
    slug: "garage-cleaning",
    label: "Garage cleaning",
    amountCents: 10_000,
  },
  "outside-windows": {
    slug: "outside-windows",
    label: "Outside windows",
    amountCents: 20_000,
  },
  "couch-cleaning": {
    slug: "couch-cleaning",
    label: "Couch cleaning",
    amountCents: 15_000,
  },
  "restocking-assistance": {
    slug: "restocking-assistance",
    label: "Restocking assistance",
    amountCents: 12_000,
  },
  "patio-outdoor-sweep": {
    slug: "patio-outdoor-sweep",
    label: "Patio/outdoor sweep",
    amountCents: 10_000,
  },
  "same-day-urgent-turnaround": {
    slug: "same-day-urgent-turnaround",
    label: "Same-day urgent turnaround",
    amountCents: 25_000,
  },
  "boardroom-detailing": {
    slug: "boardroom-detailing",
    label: "Boardroom detailing",
    amountCents: 18_000,
  },
  "kitchenette-cleaning": {
    slug: "kitchenette-cleaning",
    label: "Kitchenette cleaning",
    amountCents: 15_000,
  },
  "carpet-spot-cleaning": {
    slug: "carpet-spot-cleaning",
    label: "Carpet spot cleaning",
    amountCents: 15_000,
  },
  "sanitization-treatment": {
    slug: "sanitization-treatment",
    label: "Sanitization treatment",
    amountCents: 12_000,
  },
  "waste-removal": {
    slug: "waste-removal",
    label: "Waste removal",
    amountCents: 10_000,
  },
  "after-hours-cleaning": {
    slug: "after-hours-cleaning",
    label: "After-hours cleaning",
    amountCents: 20_000,
  },
  "rug-cleaning": {
    slug: "rug-cleaning",
    label: "Rug cleaning",
    amountCents: 18_000,
  },
  "stain-treatment": {
    slug: "stain-treatment",
    label: "Stain treatment",
    amountCents: 15_000,
  },
  "deodorizing-treatment": {
    slug: "deodorizing-treatment",
    label: "Deodorizing treatment",
    amountCents: 12_000,
  },
  "fabric-protection": {
    slug: "fabric-protection",
    label: "Fabric protection",
    amountCents: 18_000,
  },
  "upholstery-refresh": {
    slug: "upholstery-refresh",
    label: "Upholstery refresh",
    amountCents: 15_000,
  },
};

/** Applied to service + add-on subtotal before frequency discount (regular cleaning only). */
export const CLEANING_INTENSITY_MULTIPLIERS: Record<CleaningIntensity, number> = {
  standard: 1,
  detailed: 1.15,
  heavy: 1.3,
};

/** Multiplier applied to subtotal (before rounding). */
export const FREQUENCY_MULTIPLIERS: Record<PricingFrequency, number> = {
  once: 1,
  weekly: 0.9,
  biweekly: 0.95,
  monthly: 0.97,
};

export function isServiceSlug(value: string): value is ServiceSlug {
  return value in SERVICE_CATALOG;
}

export function serviceSupportsExtraRooms(slug: ServiceSlug): boolean {
  return SERVICE_CATALOG[slug].extraRoomCents != null;
}

export function isAddonSlug(value: string): value is AddonSlug {
  return value in ADDON_CATALOG;
}

export function isPricingFrequency(value: string): value is PricingFrequency {
  return value in FREQUENCY_MULTIPLIERS;
}

export function isCleaningIntensity(value: string): value is CleaningIntensity {
  return value in CLEANING_INTENSITY_MULTIPLIERS;
}

export function isEquipmentSupply(value: string): value is EquipmentSupply {
  return value === "customer" || value === "shalean";
}
