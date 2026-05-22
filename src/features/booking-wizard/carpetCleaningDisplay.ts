/**
 * Carpet Cleaning presentation copy and display helpers.
 * Does not affect pricing, payment, dispatch, lifecycle, or earnings behavior.
 */

import type { AddonSlug, PricingFrequency, ServiceSlug } from "@/features/pricing/server/types";
import {
  getPreferredCadenceReviewNote,
  getPreferredCadenceScheduleExplanation,
  PREFERRED_SCHEDULE_PAYMENT_EXPLANATION,
} from "./preferredScheduleCopy";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { FrequencyStepOption } from "./constants";
import { FREQUENCY_STEP_OPTIONS } from "./constants";
import { buildCompactReviewHeroSegments } from "./reviewDisplay";

export const CARPET_CLEANING_SLUG = "carpet-cleaning" as const;

export function isCarpetCleaningSlug(
  serviceSlug: ServiceSlug | string | null | undefined,
): serviceSlug is typeof CARPET_CLEANING_SLUG {
  return serviceSlug === CARPET_CLEANING_SLUG;
}

/** Step 1 mobile card. floor-care positioning. */
export const CARPET_SERVICE_STEP_DESCRIPTION_MOBILE = "Carpets and high-traffic area refresh";

/** Step 1 desktop card. max two lines. */
export const CARPET_SERVICE_STEP_DESCRIPTION_DESKTOP =
  "Restore freshness to carpets and high-traffic areas.";

/** Recurring labels. frequency values unchanged. */
export const CARPET_FREQUENCY_STEP_OPTIONS: FrequencyStepOption[] = [
  { value: "once", label: "One-time carpet refresh", description: "Single floor-care visit" },
  { value: "weekly", label: "Weekly", description: "Regular high-traffic upkeep" },
  { value: "biweekly", label: "Bi-weekly", description: "Every two weeks" },
  { value: "monthly", label: "Monthly", description: "Light carpet maintenance" },
];

/** Carpet add-on order. fabric and upholstery treatment. */
export const CARPET_ADDON_STEP_DISPLAY_ORDER: AddonSlug[] = [
  "mattress-cleaning",
  "couch-cleaning",
  "rug-cleaning",
  "stain-treatment",
  "deodorizing-treatment",
  "fabric-protection",
  "upholstery-refresh",
];

export const CARPET_ADDON_STEP_DESCRIPTIONS: Partial<Record<AddonSlug, string>> = {
  "mattress-cleaning": "Deep clean for one mattress. stain lift and fabric refresh.",
  "couch-cleaning": "Upholstery refresh for one couch or sofa. fabric-safe clean.",
  "rug-cleaning": "Area rug refresh. stain lift and pile revitalization.",
  "stain-treatment": "Targeted stain lifting for high-traffic or marked areas.",
  "deodorizing-treatment": "Odor neutralization for fabrics and carpeted areas.",
  "fabric-protection": "Protective treatment to help reduce future staining.",
  "upholstery-refresh": "Light upholstery clean for chairs and fabric seating.",
};

export const CARPET_ADDON_STEP_LABELS: Partial<Record<AddonSlug, string>> = {
  "mattress-cleaning": "Mattress cleaning",
  "couch-cleaning": "Couch cleaning",
};

export const CARPET_ADDONS_SECTION_HINT =
  "Fabric and upholstery extras. stains, odor, and protection treatments.";

export const CARPET_STAIN_SEVERITY_VALUES = ["light", "noticeable", "heavy"] as const;

export type CarpetStainSeverity = (typeof CARPET_STAIN_SEVERITY_VALUES)[number];

export type CarpetStainSeverityOption = {
  value: CarpetStainSeverity;
  label: string;
  description: string;
};

export const CARPET_STAIN_SEVERITY_OPTIONS: CarpetStainSeverityOption[] = [
  { value: "light", label: "Light marks", description: "General refresh." },
  { value: "noticeable", label: "Noticeable stains", description: "Extra spotting time." },
  { value: "heavy", label: "Heavy staining", description: "Dedicated stain work." },
];

export type CarpetFormAddonRow =
  | {
      kind: "addon";
      addonSlug: AddonSlug;
      label: string;
      description: string;
    }
  | {
      kind: "soon";
      id: string;
      label: string;
    };

/** @deprecated Use `CARPET_ADDON_STEP_DISPLAY_ORDER` with `AddonsStepPanel`. */
export const CARPET_FORM_ADDON_ROWS: CarpetFormAddonRow[] = CARPET_ADDON_STEP_DISPLAY_ORDER.map(
  (addonSlug) => ({
    kind: "addon" as const,
    addonSlug,
    label: CARPET_ADDON_STEP_LABELS[addonSlug] ?? addonSlug,
    description: CARPET_ADDON_STEP_DESCRIPTIONS[addonSlug] ?? "",
  }),
);

export const CARPET_ZONES_MIN = 1;
export const CARPET_ZONES_MAX = 6;

export type CarpetCleaningStepCopy = {
  mobileDescription: string;
  desktopDescription: string;
  accessNotes: {
    label: string;
    hint: string;
    placeholder: string;
  };
  detailsIntro: { title: string; description: string };
  homeSizeTitle: string;
  zonesFieldLabel: string;
  zonesFieldHint: string;
  zonesAriaLabel: string;
  addonsTitle: string;
  addonsHint: string | null;
  notesTitle: string;
  notesPlaceholder: string;
  frequencyTitle: string;
  cleaner: {
    title: string;
    subtitle: string;
    bestAvailableTitle: string;
    bestAvailableDescription: string;
    selectedHint: string;
    disclosureBestAvailable: string;
    disclosureSelected: string;
  };
};

export function getCarpetCleaningStepCopy(
  serviceSlug: ServiceSlug | null,
): CarpetCleaningStepCopy | null {
  if (!isCarpetCleaningSlug(serviceSlug)) return null;
  return {
    mobileDescription: CARPET_SERVICE_STEP_DESCRIPTION_MOBILE,
    desktopDescription: CARPET_SERVICE_STEP_DESCRIPTION_DESKTOP,
    accessNotes: {
      label: "Property access (optional)",
      hint: "Room access, ventilation, parking, pets, and areas needing stain attention.",
      placeholder:
        "e.g. Park in visitor bay 2 · Ventilate living room after clean · Stain on lounge carpet · Cat. keep study door closed",
    },
    detailsIntro: {
      title: "Carpet scope",
      description: "Standalone floor-care. we skip unrelated home questions.",
    },
    homeSizeTitle: "Carpeted rooms / zones",
    zonesFieldLabel: "Carpeted rooms",
    zonesFieldHint: "Select 1–6",
    zonesAriaLabel: "carpeted rooms",
    addonsTitle: "Carpet add-ons",
    addonsHint: CARPET_ADDONS_SECTION_HINT,
    notesTitle: "Notes",
    notesPlaceholder: "Access, pets, stain areas, ventilation notes.",
    frequencyTitle: "Visit timing",
    cleaner: {
      title: "Choose your carpet cleaning cleaner",
      subtitle: "Experienced cleaners for carpet and floor-care. ideal for stain-focused refreshes.",
      bestAvailableTitle: "Best available cleaner",
      bestAvailableDescription:
        "Fastest assignment. we match an eligible cleaner experienced in carpet and floor-care work.",
      selectedHint:
        "Your selected cleaner is offered first. Ideal for stain treatment and fabric-safe carpet refresh.",
      disclosureBestAvailable:
        "Highest-rated eligible cleaner for your area, carpet zones, and scheduled window.",
      disclosureSelected:
        "Offered to them first after payment. If unavailable, we assign the next best eligible match. your carpet clean stays booked.",
    },
  };
}

export function getCarpetFrequencyStepOptions(
  serviceSlug: ServiceSlug | null,
): FrequencyStepOption[] | null {
  return isCarpetCleaningSlug(serviceSlug) ? CARPET_FREQUENCY_STEP_OPTIONS : null;
}

export function getCarpetFrequencyLabel(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null,
): string | null {
  if (!isCarpetCleaningSlug(serviceSlug)) return null;
  return (
    CARPET_FREQUENCY_STEP_OPTIONS.find((o) => o.value === frequency)?.label ?? frequency
  );
}

export function getCarpetFrequencySectionTitle(serviceSlug: ServiceSlug | null): string | null {
  return isCarpetCleaningSlug(serviceSlug) ? "Visit timing" : null;
}

export function getCarpetScheduleStepHelperCopy(
  serviceSlug: ServiceSlug | null,
  extendedWindowEnabled: boolean,
): string | null {
  if (!isCarpetCleaningSlug(serviceSlug)) return null;
  if (extendedWindowEnabled) {
    return "Book up to 90 days ahead.";
  }
  return "Allow drying time after carpet cleaning. Good ventilation helps carpets dry faster. Pick a date with room access for each carpet zone.";
}

/** Display-only zone summaries. bedrooms field holds zone count in pricing. */
export function formatCarpetZonesLabel(zoneCount: number): string {
  return `${zoneCount} carpet zone${zoneCount === 1 ? "" : "s"}`;
}

export function formatCarpetZonesCompact(zoneCount: number): string {
  return zoneCount === 1 ? "1 zone" : `${zoneCount} zones`;
}

export function formatCarpetZonesSummary(
  serviceSlug: ServiceSlug | null,
  bedrooms: number,
  _bathrooms: number,
): { zonesLabel: string | null; bathroomsLabel: string | null } {
  if (!isCarpetCleaningSlug(serviceSlug)) {
    return { zonesLabel: null, bathroomsLabel: null };
  }
  return {
    zonesLabel: formatCarpetZonesLabel(bedrooms),
    bathroomsLabel: null,
  };
}

export type CarpetDetailsValidationCopy = {
  zonesRequired: string;
  zonesRange: string;
};

export function getCarpetDetailsValidationCopy(): CarpetDetailsValidationCopy {
  return {
    zonesRequired: "At least 1 carpeted room is required.",
    zonesRange: `Carpeted rooms must be between ${CARPET_ZONES_MIN} and ${CARPET_ZONES_MAX}.`,
  };
}

export function isCarpetStainSeverity(value: string): value is CarpetStainSeverity {
  return (CARPET_STAIN_SEVERITY_VALUES as readonly string[]).includes(value);
}

export type CarpetBookingDetailsMetadata = {
  stainSeverity: CarpetStainSeverity | null;
  petStains: boolean;
  goodDryingAirflow: boolean;
};

export function buildCarpetBookingDetailsMetadata(input: {
  stainSeverity: CarpetStainSeverity | null;
  petStains: boolean;
  goodDryingAirflow: boolean;
}): CarpetBookingDetailsMetadata | null {
  if (
    input.stainSeverity == null &&
    !input.petStains &&
    !input.goodDryingAirflow
  ) {
    return null;
  }
  return {
    stainSeverity: input.stainSeverity,
    petStains: input.petStains,
    goodDryingAirflow: input.goodDryingAirflow,
  };
}

export type CarpetCleaningReviewCopy = {
  heroSegments: (input: {
    scheduleLabel: string;
    locationLabel: string;
    zonesSummary: string | null;
    addonSummary: string | null;
    frequencyLabel: string;
  }) => string[];
  addonsSectionLabel: string;
  propertySectionTitle: string;
  zonesRowLabel: string;
  nextStepsNote: string;
  confirmationCopy: string;
  accessNotesLabel: string;
  recurringScheduleReviewNote: (frequency: PricingFrequency) => string | null;
  recurringScheduleExplanation: (frequency: PricingFrequency) => string | null;
  recurringPaymentExplanation: (frequency: PricingFrequency) => string | null;
};

export function getCarpetCleaningReviewCopy(
  serviceSlug: ServiceSlug | null,
): CarpetCleaningReviewCopy | null {
  if (!isCarpetCleaningSlug(serviceSlug)) return null;
  return {
    heroSegments: buildCarpetReviewHeroSegments,
    addonsSectionLabel: "Floor-care extras",
    propertySectionTitle: "Carpet cleaning areas",
    zonesRowLabel: "Carpet zones",
    nextStepsNote:
      "Next: secure Paystack checkout. Cleaner assignment begins after payment confirmation.",
    confirmationCopy:
      "I confirm these carpet cleaning details are correct and I'm ready for secure payment.",
    accessNotesLabel: "Access & stain notes",
    recurringScheduleReviewNote: getCarpetRecurringScheduleReviewNote,
    recurringScheduleExplanation: getCarpetRecurringScheduleExplanation,
    recurringPaymentExplanation: getCarpetRecurringPaymentExplanation,
  };
}

export function buildCarpetReviewHeroSegments(input: {
  scheduleLabel: string;
  locationLabel: string;
  zonesSummary: string | null;
  addonSummary?: string | null;
  frequencyLabel?: string | null;
}): string[] {
  return buildCompactReviewHeroSegments(
    input.scheduleLabel,
    input.locationLabel,
    input.zonesSummary,
  );
}

function getCarpetRecurringScheduleReviewNote(
  frequency: PricingFrequency,
): string | null {
  return getPreferredCadenceReviewNote(frequency);
}

function getCarpetRecurringScheduleExplanation(
  frequency: PricingFrequency,
): string | null {
  return getPreferredCadenceScheduleExplanation(frequency);
}

function getCarpetRecurringPaymentExplanation(frequency: PricingFrequency): string | null {
  if (frequency === "once") return null;
  return PREFERRED_SCHEDULE_PAYMENT_EXPLANATION;
}

export type CarpetCleaningCheckoutCopy = {
  whatHappensNext: readonly string[];
  floorCareNote: string;
  amountHelper: (customerEmail: string, recurringNote: string | null) => string;
};

export function getCarpetCleaningCheckoutCopy(
  serviceSlug: ServiceSlug | null,
): CarpetCleaningCheckoutCopy | null {
  if (!isCarpetCleaningSlug(serviceSlug)) return null;
  return {
    whatHappensNext: CARPET_CHECKOUT_WHAT_HAPPENS_NEXT,
    floorCareNote: "Allow drying time after cleaning. ventilation helps carpets dry faster.",
    amountHelper: (customerEmail, recurringNote) => {
      if (recurringNote) return recurringNote;
      return `Paying as ${customerEmail} · Carpet cleaner assignment begins after payment.`;
    },
  };
}

export const CARPET_CHECKOUT_WHAT_HAPPENS_NEXT = [
  "Carpet cleaning scheduled",
  "Confirmation email to you",
  "Cleaner assignment for your floor-care visit",
] as const;

export function getCarpetWizardSummaryFrequencyLabel(serviceSlug: ServiceSlug | null): string | null {
  return isCarpetCleaningSlug(serviceSlug) ? "Visit timing" : null;
}

export function getCarpetWizardSummaryAddonsLabel(serviceSlug: ServiceSlug | null): string | null {
  return isCarpetCleaningSlug(serviceSlug) ? "Floor-care extras" : null;
}

export function getCarpetWizardSummaryLocationLabel(serviceSlug: ServiceSlug | null): string | null {
  return isCarpetCleaningSlug(serviceSlug) ? "Location" : null;
}

export function getCarpetWizardSummaryEstimateHint(serviceSlug: ServiceSlug | null): string | null {
  return isCarpetCleaningSlug(serviceSlug)
    ? "Estimate only. confirmed total on review."
    : null;
}

export function getCarpetWizardCleanerFootnote(serviceSlug: ServiceSlug | null): string | null {
  return isCarpetCleaningSlug(serviceSlug)
    ? "Cleaner preference is saved with your carpet clean. Assignment finalizes after payment."
    : null;
}

export function customerCarpetStatusLine(
  status: BookingStatus,
  defaultLine: string,
): string {
  switch (status) {
    case "pending_payment":
      return "Complete checkout to secure your carpet cleaning slot.";
    case "confirmed":
      return "Preparing cleaner assignment for your floor-care visit.";
    case "pending_assignment":
      return "Finding a cleaner for your carpet cleaning schedule.";
    case "assigned":
      return "Your carpet cleaning cleaner is confirmed.";
    case "in_progress":
      return "Carpet refresh in progress. allow drying time after cleaning.";
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Carpet refresh complete. ventilation helps finishing dry time.";
    default:
      return defaultLine;
  }
}

export function customerCarpetTimingHint(
  status: BookingStatus,
  defaultHint: string | null,
): string | null {
  switch (status) {
    case "pending_payment":
      return "Allow drying time after your scheduled clean";
    case "confirmed":
    case "pending_assignment":
      return "Usually within a few minutes";
    case "assigned":
      return "Before your scheduled carpet cleaning window";
    case "in_progress":
      return "Ventilate carpeted areas when possible";
    default:
      return defaultHint;
  }
}

export function cleanerCarpetJobDescription(
  status: BookingStatus,
  defaultDescription: string,
): string {
  switch (status) {
    case "assigned":
      return "Carpet clean scheduled. review stain notes and zone list before arrival.";
    case "in_progress":
      return "Floor-care in progress. prioritize high-traffic areas and protect delicate fabrics.";
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Carpet clean complete. Payout status is below.";
    default:
      return defaultDescription;
  }
}

export function cleanerCarpetExpectedUpdate(
  status: BookingStatus,
  defaultUpdate: string | null,
): string | null {
  switch (status) {
    case "assigned":
      return "Start on site. follow stain notes and allow ventilation after cleaning";
    case "in_progress":
      return "Mark complete when carpet zones are refreshed and customer notes addressed";
    default:
      return defaultUpdate;
  }
}

export type AdminCarpetListBadge = {
  label: string;
  tone: "info" | "neutral" | "warning";
};

export function adminCarpetOperationalBadges(input: {
  serviceLabel: string;
  frequency?: PricingFrequency | null;
}): AdminCarpetListBadge[] {
  if (input.serviceLabel !== "Carpet Cleaning") return [];

  const badges: AdminCarpetListBadge[] = [{ label: "Floor-care", tone: "info" }];

  if (input.frequency && input.frequency !== "once") {
    badges.push({ label: "Recurring carpet", tone: "neutral" });
  }

  return badges;
}

export function getCarpetCleaningCustomerCopy(): {
  statusLine: typeof customerCarpetStatusLine;
  timingHint: typeof customerCarpetTimingHint;
} {
  return {
    statusLine: customerCarpetStatusLine,
    timingHint: customerCarpetTimingHint,
  };
}

export function getCarpetCleaningCleanerCopy(): {
  jobDescription: typeof cleanerCarpetJobDescription;
  expectedUpdate: typeof cleanerCarpetExpectedUpdate;
} {
  return {
    jobDescription: cleanerCarpetJobDescription,
    expectedUpdate: cleanerCarpetExpectedUpdate,
  };
}

export function getCarpetCleaningAdminCopy(): {
  listBadges: typeof adminCarpetOperationalBadges;
} {
  return { listBadges: adminCarpetOperationalBadges };
}
