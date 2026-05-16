import type { AddonSlug, PricingFrequency, ServiceSlug } from "./types";

/** All amounts are integer ZAR cents. */
export const FIXED_CLEANER_PAYOUT_CENTS = 25_000;
export const MIN_PERCENT_PAYOUT_CENTS = 25_000;
export const MAX_PERCENT_PAYOUT_CENTS = 30_000;

export type ServicePricingRule = {
  slug: ServiceSlug;
  label: string;
  /** Included in base: 1 bedroom + 1 bathroom for residential-style services. */
  baseCents: number;
  extraBedroomCents: number;
  extraBathroomCents: number;
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
  },
  "deep-cleaning": {
    slug: "deep-cleaning",
    label: "Deep Cleaning",
    baseCents: 85_000,
    extraBedroomCents: 15_000,
    extraBathroomCents: 12_000,
    fixedCleanerPayout: true,
  },
  "moving-cleaning": {
    slug: "moving-cleaning",
    label: "Moving Cleaning",
    baseCents: 120_000,
    extraBedroomCents: 20_000,
    extraBathroomCents: 15_000,
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
  "inside-fridge": { slug: "inside-fridge", label: "Inside fridge", amountCents: 15_000 },
  "inside-oven": { slug: "inside-oven", label: "Inside oven", amountCents: 18_000 },
  "interior-windows": {
    slug: "interior-windows",
    label: "Interior windows",
    amountCents: 20_000,
  },
  laundry: { slug: "laundry", label: "Laundry", amountCents: 12_000 },
  balcony: { slug: "balcony", label: "Balcony", amountCents: 10_000 },
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

export function isAddonSlug(value: string): value is AddonSlug {
  return value in ADDON_CATALOG;
}

export function isPricingFrequency(value: string): value is PricingFrequency {
  return value in FREQUENCY_MULTIPLIERS;
}
