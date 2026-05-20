/**
 * Move In/Out Cleaning presentation copy and display helpers.
 * Does not affect pricing, payment, dispatch, lifecycle, or earnings behavior.
 */

import type { AddonSlug, PricingFrequency, ServiceSlug } from "@/features/pricing/server/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { FrequencyStepOption } from "./constants";
import { FREQUENCY_STEP_OPTIONS } from "./constants";
import {
  DEEP_MOVING_ADDON_STEP_DESCRIPTIONS,
  DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER,
  DEEP_MOVING_ADDON_STEP_LABELS,
} from "./deepMovingAddonDisplay";
import { buildCompactReviewHeroSegments } from "./reviewDisplay";

export const MOVING_CLEANING_SLUG = "moving-cleaning" as const;

export function isMovingCleaningSlug(
  serviceSlug: ServiceSlug | string | null | undefined,
): serviceSlug is typeof MOVING_CLEANING_SLUG {
  return serviceSlug === MOVING_CLEANING_SLUG;
}

/** Step 1 mobile card — move-ready positioning. */
export const MOVING_SERVICE_STEP_DESCRIPTION_MOBILE = "Move-in, handover, and inspection prep";

/** Step 1 desktop card — max two lines. */
export const MOVING_SERVICE_STEP_DESCRIPTION_DESKTOP =
  "Detailed cleaning before move-in, handover, or inspection.";

/** Softer recurring labels — frequency values unchanged. */
export const MOVING_FREQUENCY_STEP_OPTIONS: FrequencyStepOption[] = [
  { value: "once", label: "One-time move clean", description: "Single handover or move-in prep" },
  { value: "weekly", label: "Weekly", description: "Ongoing property maintenance" },
  { value: "biweekly", label: "Bi-weekly", description: "Every two weeks" },
  { value: "monthly", label: "Monthly", description: "Light upkeep between tenancies" },
];

/** Inspection-focused add-on order — display only. */
export const MOVING_ADDON_STEP_DISPLAY_ORDER = DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER;

export const MOVING_ADDON_STEP_DESCRIPTIONS = DEEP_MOVING_ADDON_STEP_DESCRIPTIONS;

export const MOVING_ADDON_STEP_LABELS = DEEP_MOVING_ADDON_STEP_LABELS;

export const MOVING_ADDONS_SECTION_HINT =
  "Move and handover extras — balconies, carpets, ceilings, garages, mattresses, windows, and upholstery.";

export type MovingCleaningStepCopy = {
  mobileDescription: string;
  desktopDescription: string;
  accessNotes: {
    label: string;
    hint: string;
    placeholder: string;
  };
  detailsIntro: { title: string; description: string };
  homeSizeTitle: string;
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

export function getMovingCleaningStepCopy(
  serviceSlug: ServiceSlug | null,
): MovingCleaningStepCopy | null {
  if (!isMovingCleaningSlug(serviceSlug)) return null;
  return {
    mobileDescription: MOVING_SERVICE_STEP_DESCRIPTION_MOBILE,
    desktopDescription: MOVING_SERVICE_STEP_DESCRIPTION_DESKTOP,
    accessNotes: {
      label: "Property access (optional)",
      hint: "Keys, vacant access, estate or building entry, parking, and handover timing.",
      placeholder:
        "e.g. Keys at lockbox on gate · Vacant property · Estate access code 4521 · Park at loading bay B",
    },
    detailsIntro: {
      title: "Property & move preparation",
      description:
        "Property size, visit timing, and inspection-focused extras for move-in or handover.",
    },
    homeSizeTitle: "Property size",
    addonsTitle: "Inspection-focused extras",
    addonsHint: MOVING_ADDONS_SECTION_HINT,
    notesTitle: "Move instructions",
    notesPlaceholder:
      "Move-in or move-out date, key collection, inspection time, utilities, appliances left on site, or focus areas.",
    frequencyTitle: "Visit timing",
    cleaner: {
      title: "Choose your move preparation cleaner",
      subtitle: "Detail-oriented cleaners for vacant homes and inspection-ready standards.",
      bestAvailableTitle: "Best available cleaner",
      bestAvailableDescription:
        "Fastest assignment — we match an eligible cleaner experienced in move preparation.",
      selectedHint:
        "Your selected cleaner is offered first. Ideal for vacant properties and handover-ready cleaning.",
      disclosureBestAvailable:
        "Highest-rated eligible cleaner for your property, area, and scheduled move window.",
      disclosureSelected:
        "Offered to them first after payment. If unavailable, we assign the next best eligible match — your move clean stays booked.",
    },
  };
}

export function getMovingFrequencyStepOptions(
  serviceSlug: ServiceSlug | null,
): FrequencyStepOption[] | null {
  return isMovingCleaningSlug(serviceSlug) ? MOVING_FREQUENCY_STEP_OPTIONS : null;
}

export function getMovingFrequencyLabel(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null,
): string | null {
  if (!isMovingCleaningSlug(serviceSlug)) return null;
  return (
    MOVING_FREQUENCY_STEP_OPTIONS.find((o) => o.value === frequency)?.label ?? frequency
  );
}

export function getMovingFrequencySectionTitle(serviceSlug: ServiceSlug | null): string | null {
  return isMovingCleaningSlug(serviceSlug) ? "Visit timing" : null;
}

export function getMovingScheduleStepHelperCopy(
  serviceSlug: ServiceSlug | null,
  extendedWindowEnabled: boolean,
): string | null {
  if (!isMovingCleaningSlug(serviceSlug)) return null;
  if (extendedWindowEnabled) {
    return "Book up to 90 days ahead.";
  }
  return "Schedule before your move-in, handover, or inspection. Allow enough time before key collection or occupancy.";
}

export type MovingCleaningReviewCopy = {
  heroSegments: (input: {
    scheduleLabel: string;
    locationLabel: string;
    bedBathSummary: string | null;
    addonSummary: string | null;
    frequencyLabel: string;
  }) => string[];
  addonsSectionLabel: string;
  propertySectionTitle: string;
  nextStepsNote: string;
  confirmationCopy: string;
  accessNotesLabel: string;
  recurringScheduleReviewNote: (frequency: PricingFrequency) => string | null;
  recurringScheduleExplanation: (frequency: PricingFrequency) => string | null;
  recurringPaymentExplanation: (frequency: PricingFrequency) => string | null;
};

export function getMovingCleaningReviewCopy(
  serviceSlug: ServiceSlug | null,
): MovingCleaningReviewCopy | null {
  if (!isMovingCleaningSlug(serviceSlug)) return null;
  return {
    heroSegments: buildMovingReviewHeroSegments,
    addonsSectionLabel: "Inspection extras",
    propertySectionTitle: "Move preparation",
    nextStepsNote:
      "Next: secure Paystack checkout. Cleaner assignment begins after payment confirmation.",
    confirmationCopy:
      "I confirm these move preparation details are correct and I'm ready for secure payment.",
    accessNotesLabel: "Property handover details",
    recurringScheduleReviewNote: getMovingRecurringScheduleReviewNote,
    recurringScheduleExplanation: getMovingRecurringScheduleExplanation,
    recurringPaymentExplanation: getMovingRecurringPaymentExplanation,
  };
}

export function buildMovingReviewHeroSegments(input: {
  scheduleLabel: string;
  locationLabel: string;
  bedBathSummary: string | null;
  addonSummary?: string | null;
  frequencyLabel?: string | null;
}): string[] {
  return buildCompactReviewHeroSegments(
    input.scheduleLabel,
    input.locationLabel,
    input.bedBathSummary,
  );
}

function getMovingRecurringScheduleReviewNote(
  frequency: PricingFrequency,
): string | null {
  switch (frequency) {
    case "weekly":
      return "Repeats weekly on this move preparation day and time.";
    case "biweekly":
      return "Repeats every 2 weeks on this schedule.";
    case "monthly":
      return "Repeats monthly on this schedule.";
    default:
      return null;
  }
}

function getMovingRecurringScheduleExplanation(
  frequency: PricingFrequency,
): string | null {
  switch (frequency) {
    case "weekly":
      return "Repeats every week on the day and time you selected.";
    case "biweekly":
      return "Repeats every two weeks on the day and time you selected.";
    case "monthly":
      return "Repeats monthly on the day and time you selected.";
    default:
      return null;
  }
}

function getMovingRecurringPaymentExplanation(frequency: PricingFrequency): string | null {
  if (frequency === "once") return null;
  return "Today's payment secures this move clean only. We'll confirm any recurring schedule after payment; future visits are arranged in your account.";
}

export type MovingCleaningCheckoutCopy = {
  whatHappensNext: readonly string[];
  guestReadyNote: string;
  amountHelper: (customerEmail: string, recurringNote: string | null) => string;
};

export function getMovingCleaningCheckoutCopy(
  serviceSlug: ServiceSlug | null,
): MovingCleaningCheckoutCopy | null {
  if (!isMovingCleaningSlug(serviceSlug)) return null;
  return {
    whatHappensNext: MOVING_CHECKOUT_WHAT_HAPPENS_NEXT,
    guestReadyNote:
      "We'll prepare your property before move-in, handover, or inspection.",
    amountHelper: (customerEmail, recurringNote) => {
      if (recurringNote) return recurringNote;
      return `Paying as ${customerEmail} · Move cleaner assignment begins after payment.`;
    },
  };
}

export const MOVING_CHECKOUT_WHAT_HAPPENS_NEXT = [
  "Move cleaning scheduled",
  "Confirmation email to you",
  "Cleaner assignment for your property",
] as const;

export function getMovingWizardSummaryFrequencyLabel(serviceSlug: ServiceSlug | null): string | null {
  return isMovingCleaningSlug(serviceSlug) ? "Visit timing" : null;
}

export function getMovingWizardSummaryAddonsLabel(serviceSlug: ServiceSlug | null): string | null {
  return isMovingCleaningSlug(serviceSlug) ? "Inspection extras" : null;
}

export function getMovingWizardSummaryLocationLabel(serviceSlug: ServiceSlug | null): string | null {
  return isMovingCleaningSlug(serviceSlug) ? "Property" : null;
}

export function getMovingWizardSummaryEstimateHint(serviceSlug: ServiceSlug | null): string | null {
  return isMovingCleaningSlug(serviceSlug)
    ? "Estimate only — confirmed total on review."
    : null;
}

export function getMovingWizardCleanerFootnote(serviceSlug: ServiceSlug | null): string | null {
  return isMovingCleaningSlug(serviceSlug)
    ? "Cleaner preference is saved with your move clean. Assignment finalizes after payment."
    : null;
}

/** Customer dashboard status — presentation only. */
export function customerMovingStatusLine(
  status: BookingStatus,
  defaultLine: string,
): string {
  switch (status) {
    case "pending_payment":
      return "Complete checkout to secure your move preparation slot.";
    case "confirmed":
      return "Preparing cleaner assignment for your property handover.";
    case "pending_assignment":
      return "Finding a cleaner for your move preparation schedule.";
    case "assigned":
      return "Your move preparation cleaner is confirmed.";
    case "in_progress":
      return "Inspection-ready cleaning in progress.";
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Move clean complete — property prepared for handover or occupancy.";
    default:
      return defaultLine;
  }
}

export function customerMovingTimingHint(
  status: BookingStatus,
  defaultHint: string | null,
): string | null {
  switch (status) {
    case "pending_payment":
      return "Before move-in, handover, or inspection";
    case "confirmed":
    case "pending_assignment":
      return "Usually within a few minutes";
    case "assigned":
      return "Before your scheduled move preparation window";
    case "in_progress":
      return "During your scheduled window";
    default:
      return defaultHint;
  }
}

export function cleanerMovingJobDescription(
  status: BookingStatus,
  defaultDescription: string,
): string {
  switch (status) {
    case "assigned":
      return "Move clean scheduled — confirm vacant access and move instructions before arrival.";
    case "in_progress":
      return "Move preparation in progress — finish inspection-ready standards before marking complete.";
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Move clean complete. Payout status is below.";
    default:
      return defaultDescription;
  }
}

export function cleanerMovingExpectedUpdate(
  status: BookingStatus,
  defaultUpdate: string | null,
): string | null {
  switch (status) {
    case "assigned":
      return "Start on site — follow property access and inspection extras";
    case "in_progress":
      return "Mark complete when the property is handover-ready";
    default:
      return defaultUpdate;
  }
}

export type AdminMovingListBadge = {
  label: string;
  tone: "info" | "neutral" | "warning";
};

export function adminMovingOperationalBadges(input: {
  serviceLabel: string;
  scheduledStart?: string;
  frequency?: PricingFrequency | null;
}): AdminMovingListBadge[] {
  if (input.serviceLabel !== "Moving Cleaning") return [];

  const badges: AdminMovingListBadge[] = [{ label: "Move clean", tone: "info" }];

  if (input.scheduledStart && isSameCalendarDayMove(input.scheduledStart)) {
    badges.push({ label: "Handover day", tone: "warning" });
  }

  if (input.frequency && input.frequency !== "once") {
    badges.push({ label: "Recurring property", tone: "neutral" });
  }

  return badges;
}

function isSameCalendarDayMove(scheduledStart: string): boolean {
  const start = new Date(scheduledStart);
  if (Number.isNaN(start.getTime())) return false;
  const now = new Date();
  return (
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate()
  );
}

/** Bundled customer-facing wizard/dashboard status copy for tests. */
export function getMovingCleaningCustomerCopy(): {
  statusLine: typeof customerMovingStatusLine;
  timingHint: typeof customerMovingTimingHint;
} {
  return {
    statusLine: customerMovingStatusLine,
    timingHint: customerMovingTimingHint,
  };
}

/** Bundled cleaner copy for tests. */
export function getMovingCleaningCleanerCopy(): {
  jobDescription: typeof cleanerMovingJobDescription;
  expectedUpdate: typeof cleanerMovingExpectedUpdate;
} {
  return {
    jobDescription: cleanerMovingJobDescription,
    expectedUpdate: cleanerMovingExpectedUpdate,
  };
}

/** Bundled admin copy for tests. */
export function getMovingCleaningAdminCopy(): {
  listBadges: typeof adminMovingOperationalBadges;
} {
  return { listBadges: adminMovingOperationalBadges };
}
