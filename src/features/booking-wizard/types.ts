import type { CleanerPublicCard } from "@/features/cleaners/server/types";
import type {
  AddonSlug,
  PricingBreakdown,
  PricingFrequency,
  ServiceSlug,
} from "@/features/pricing/server/types";

export const WIZARD_STEPS = [
  "service",
  "datetime",
  "location",
  "details",
  "cleaner",
  "review",
  "checkout",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export type CleanerPreferenceMode = "best_available" | "selected";

export type BookingWizardState = {
  step: WizardStep;
  serviceSlug: ServiceSlug | null;
  date: string;
  time: string;
  addressLine1: string;
  suburb: string;
  city: string;
  locationNotes: string;
  bedrooms: number;
  bathrooms: number;
  propertySizeSqm: number | null;
  frequency: PricingFrequency;
  addons: AddonSlug[];
  specialInstructions: string;
  cleanerPreferenceMode: CleanerPreferenceMode;
  selectedCleanerId: string | null;
  selectedCleanerDisplayName: string | null;
  /** Set after review step fetches quote */
  quote: PricingBreakdown | null;
  reviewConfirmed: boolean;
  /** Cleaner cards from availability API (step 5) */
  availableCleaners: CleanerPublicCard[];
  checkoutSubmitting: boolean;
  checkoutAttemptId: string | null;
  /** Stable key for lock + payment idempotency across retries */
  checkoutIdempotencyKey: string | null;
  lockId: string | null;
  lockedBookingId: string | null;
};

export const INITIAL_WIZARD_STATE: BookingWizardState = {
  step: "service",
  serviceSlug: null,
  date: "",
  time: "",
  addressLine1: "",
  suburb: "",
  city: "",
  locationNotes: "",
  bedrooms: 2,
  bathrooms: 1,
  propertySizeSqm: null,
  frequency: "once",
  addons: [],
  specialInstructions: "",
  cleanerPreferenceMode: "best_available",
  selectedCleanerId: null,
  selectedCleanerDisplayName: null,
  quote: null,
  reviewConfirmed: false,
  availableCleaners: [],
  checkoutSubmitting: false,
  checkoutAttemptId: null,
  checkoutIdempotencyKey: null,
  lockId: null,
  lockedBookingId: null,
};

export type StepValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
};
