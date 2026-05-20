import type { CleanerPublicCard } from "@/features/cleaners/server/types";
import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  PricingBreakdown,
  PricingFrequency,
  ServiceSlug,
} from "@/features/pricing/server/types";
import type { CarpetStainSeverity } from "./carpetCleaningDisplay";

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
  /** Contact mobile for this booking (may be pre-filled from profile). */
  contactPhone: string;
  /** Profile phone at wizard load; not persisted to localStorage. */
  profilePhone: string | null;
  bedrooms: number;
  bathrooms: number;
  /** Additional non-bedroom/bathroom spaces (regular cleaning only). */
  extraRooms: number;
  /** Home condition / workload (regular cleaning only; default standard). */
  cleaningIntensity: CleaningIntensity;
  /** Who provides cleaning supplies/equipment (regular cleaning only; default customer). */
  equipmentSupply: EquipmentSupply;
  /** Team support preference (regular cleaning only; 1 = default, 2 = request only). */
  requestedTeamSize: 1 | 2;
  propertySizeSqm: number | null;
  frequency: PricingFrequency;
  addons: AddonSlug[];
  /** Carpet cleaning only — display/metadata; does not affect quote. */
  carpetStainSeverity: CarpetStainSeverity | null;
  /** Carpet cleaning only — display/metadata; does not affect quote. */
  carpetPetStains: boolean;
  /** Carpet cleaning only — display/metadata; does not affect quote. */
  carpetGoodDryingAirflow: boolean;
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
  contactPhone: "",
  profilePhone: null,
  bedrooms: 2,
  bathrooms: 1,
  extraRooms: 0,
  cleaningIntensity: "standard",
  equipmentSupply: "customer",
  requestedTeamSize: 1,
  propertySizeSqm: null,
  frequency: "once",
  addons: [],
  carpetStainSeverity: null,
  carpetPetStains: false,
  carpetGoodDryingAirflow: false,
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
