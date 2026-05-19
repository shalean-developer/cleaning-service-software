/** Supported service identifiers (code-first catalog). */
export const SERVICE_SLUGS = [
  "regular-cleaning",
  "deep-cleaning",
  "moving-cleaning",
  "airbnb-cleaning",
  "office-cleaning",
  "carpet-cleaning",
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

export const PRICING_FREQUENCIES = [
  "once",
  "weekly",
  "biweekly",
  "monthly",
] as const;

export type PricingFrequency = (typeof PRICING_FREQUENCIES)[number];

export const ADDON_SLUGS = [
  "inside-cabinets",
  "inside-fridge",
  "inside-oven",
  "interior-walls",
  "interior-windows",
  "laundry",
  "balcony",
] as const;

export type AddonSlug = (typeof ADDON_SLUGS)[number];

/** Home condition / workload for regular cleaning (not a service type). */
export const CLEANING_INTENSITIES = ["standard", "detailed", "heavy"] as const;

export type CleaningIntensity = (typeof CLEANING_INTENSITIES)[number];

/** Who provides cleaning supplies/equipment (regular cleaning only). */
export const EQUIPMENT_SUPPLY_OPTIONS = ["customer", "shalean"] as const;

export type EquipmentSupply = (typeof EQUIPMENT_SUPPLY_OPTIONS)[number];

export const PRICING_VERSION = "2026-05-16-mvp";

export const PRICING_CURRENCY = "ZAR" as const;

export type PricingInput = {
  serviceSlug: ServiceSlug;
  bedrooms: number;
  bathrooms: number;
  /**
   * Additional non-bedroom/bathroom spaces (regular cleaning only).
   * Examples: study, laundry room, playroom, second lounge.
   */
  extraRooms?: number;
  /**
   * Regular cleaning only — home condition / workload (default standard).
   * Detailed (+15%) and heavy (+30%) add time; not a deep clean.
   */
  cleaningIntensity?: CleaningIntensity;
  /**
   * Regular cleaning only — who brings cleaning supplies/equipment (default customer).
   * `shalean` adds a flat equipment fee; `customer` is no charge.
   */
  equipmentSupply?: EquipmentSupply;
  /** Optional property size in square metres (office / large homes). */
  propertySizeSqm?: number | null;
  frequency?: PricingFrequency;
  addons?: AddonSlug[];
  /** Number of cleaners on the job (default 1). Values above 1 use team payout rules. */
  teamSize?: number;
  /**
   * Regular cleaning only — customer preference for team size (1 or 2).
   * Request-only in NF-7B: adds a surcharge when 2; does not affect assignment or payout.
   */
  requestedTeamSize?: number;
  /**
   * Months the assigned cleaner has been active (for earnings preview only).
   * When omitted, a conservative preview is used.
   */
  cleanerTenureMonths?: number | null;
};

export type PricingLineItem = {
  code: string;
  label: string;
  quantity?: number;
  unitAmountCents?: number;
  amountCents: number;
};

export type CleanerEarningsPreview = {
  perCleanerAmountCents: number;
  teamSize: number;
  totalCleanerPayoutCents: number;
  ruleApplied: string;
  metadata: Record<string, unknown>;
};

export type PricingBreakdown = {
  pricingVersion: typeof PRICING_VERSION;
  currency: typeof PRICING_CURRENCY;
  serviceSlug: ServiceSlug;
  lineItems: PricingLineItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  frequency: PricingFrequency;
  cleanerEarnings: CleanerEarningsPreview;
  metadata: Record<string, unknown>;
};

export type PricingQuoteSuccess = {
  ok: true;
  breakdown: PricingBreakdown;
};

export type PricingErrorCode =
  | "UNKNOWN_SERVICE"
  | "INVALID_BEDROOMS"
  | "INVALID_BATHROOMS"
  | "INVALID_EXTRA_ROOMS"
  | "INVALID_CLEANING_INTENSITY"
  | "INVALID_EQUIPMENT_SUPPLY"
  | "INVALID_PROPERTY_SIZE"
  | "INVALID_FREQUENCY"
  | "UNKNOWN_ADDON"
  | "INVALID_TEAM_SIZE"
  | "INVALID_REQUESTED_TEAM_SIZE"
  | "NEGATIVE_AMOUNT"
  | "ZERO_TOTAL"
  | "UNSAFE_TOTAL"
  | "UNSAFE_CLEANER_EARNINGS"
  | "INVALID_TENURE";

export type PricingQuoteFailure = {
  ok: false;
  code: PricingErrorCode;
  message: string;
};

export type PricingQuoteResult = PricingQuoteSuccess | PricingQuoteFailure;
