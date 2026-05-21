/**
 * Deep Cleaning presentation copy and display helpers.
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
import {
  DEEP_MOVING_ADDON_STEP_DESCRIPTIONS,
  DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER,
  DEEP_MOVING_ADDON_STEP_LABELS,
} from "./deepMovingAddonDisplay";
import { buildCompactReviewHeroSegments } from "./reviewDisplay";

export const DEEP_CLEANING_SLUG = "deep-cleaning" as const;

export function isDeepCleaningSlug(
  serviceSlug: ServiceSlug | string | null | undefined,
): serviceSlug is typeof DEEP_CLEANING_SLUG {
  return serviceSlug === DEEP_CLEANING_SLUG;
}

/** Step 1 mobile card — restoration positioning. */
export const DEEP_SERVICE_STEP_DESCRIPTION_MOBILE = "Buildup removal and seasonal resets";

/** Step 1 desktop card — max two lines. */
export const DEEP_SERVICE_STEP_DESCRIPTION_DESKTOP =
  "Detailed cleaning for neglected buildup and seasonal resets.";

/** Softer recurring labels — frequency values unchanged. */
export const DEEP_FREQUENCY_STEP_OPTIONS: FrequencyStepOption[] = [
  { value: "once", label: "One-time deep clean", description: "Full-home restoration reset" },
  { value: "weekly", label: "Weekly", description: "Intensive upkeep between resets" },
  { value: "biweekly", label: "Bi-weekly", description: "Every two weeks" },
  { value: "monthly", label: "Monthly", description: "Seasonal maintenance between deep cleans" },
];

/** Restoration-focused add-on order — display only. */
export const DEEP_ADDON_STEP_DISPLAY_ORDER = DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER;

export const DEEP_ADDON_STEP_DESCRIPTIONS = DEEP_MOVING_ADDON_STEP_DESCRIPTIONS;

export const DEEP_ADDON_STEP_LABELS = DEEP_MOVING_ADDON_STEP_LABELS;

export const DEEP_ADDONS_SECTION_HINT =
  "Deep and move-ready extras — balconies, carpets, ceilings, garages, mattresses, windows, and upholstery.";

export type DeepCleaningStepCopy = {
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

export function getDeepCleaningStepCopy(
  serviceSlug: ServiceSlug | null,
): DeepCleaningStepCopy | null {
  if (!isDeepCleaningSlug(serviceSlug)) return null;
  return {
    mobileDescription: DEEP_SERVICE_STEP_DESCRIPTION_MOBILE,
    desktopDescription: DEEP_SERVICE_STEP_DESCRIPTION_DESKTOP,
    accessNotes: {
      label: "Property access (optional)",
      hint: "Parking, building entry, pets, clutter, and priority areas needing extra attention.",
      placeholder:
        "e.g. Park in visitor bay 3 · Gate code 4521 · Cat in study — secure fragile items · Kitchen buildup priority",
    },
    detailsIntro: {
      title: "Home restoration details",
      description:
        "Property size, visit timing, and detailed extras for intensive cleaning and neglected-space recovery.",
    },
    homeSizeTitle: "Home size",
    addonsTitle: "Detailed cleaning extras",
    addonsHint: DEEP_ADDONS_SECTION_HINT,
    notesTitle: "Attention areas",
    notesPlaceholder:
      "Priority rooms, buildup or problem areas, seasonal reset goals, pets, or preparation notes for your cleaner.",
    frequencyTitle: "Visit timing",
    cleaner: {
      title: "Choose your deep cleaning cleaner",
      subtitle: "Detail-oriented cleaners for intensive restoration and homes needing extra attention.",
      bestAvailableTitle: "Best available cleaner",
      bestAvailableDescription:
        "Fastest assignment — we match an eligible cleaner experienced in detailed restoration cleaning.",
      selectedHint:
        "Your selected cleaner is offered first. Ideal for homes needing intensive cleaning and detailed surface attention.",
      disclosureBestAvailable:
        "Highest-rated eligible cleaner for your home, area, and scheduled deep clean window.",
      disclosureSelected:
        "Offered to them first after payment. If unavailable, we assign the next best eligible match — your deep clean stays booked.",
    },
  };
}

export function getDeepFrequencyStepOptions(
  serviceSlug: ServiceSlug | null,
): FrequencyStepOption[] | null {
  return isDeepCleaningSlug(serviceSlug) ? DEEP_FREQUENCY_STEP_OPTIONS : null;
}

export function getDeepFrequencyLabel(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null,
): string | null {
  if (!isDeepCleaningSlug(serviceSlug)) return null;
  return (
    DEEP_FREQUENCY_STEP_OPTIONS.find((o) => o.value === frequency)?.label ?? frequency
  );
}

export function getDeepFrequencySectionTitle(serviceSlug: ServiceSlug | null): string | null {
  return isDeepCleaningSlug(serviceSlug) ? "Visit timing" : null;
}

export function getDeepScheduleStepHelperCopy(
  serviceSlug: ServiceSlug | null,
  extendedWindowEnabled: boolean,
): string | null {
  if (!isDeepCleaningSlug(serviceSlug)) return null;
  if (extendedWindowEnabled) {
    return "Book up to 90 days ahead.";
  }
  return "Deep cleans may require more detailed preparation time. Ideal before holidays, events, or seasonal resets — allow enough cleaning time on your chosen date.";
}

export type DeepCleaningReviewCopy = {
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

export function getDeepCleaningReviewCopy(
  serviceSlug: ServiceSlug | null,
): DeepCleaningReviewCopy | null {
  if (!isDeepCleaningSlug(serviceSlug)) return null;
  return {
    heroSegments: buildDeepReviewHeroSegments,
    addonsSectionLabel: "Detailed cleaning extras",
    propertySectionTitle: "Deep-clean priorities",
    nextStepsNote:
      "Next: secure Paystack checkout. Cleaner assignment begins after payment confirmation.",
    confirmationCopy:
      "I confirm these deep cleaning details are correct and I'm ready for secure payment.",
    accessNotesLabel: "Access & preparation details",
    recurringScheduleReviewNote: getDeepRecurringScheduleReviewNote,
    recurringScheduleExplanation: getDeepRecurringScheduleExplanation,
    recurringPaymentExplanation: getDeepRecurringPaymentExplanation,
  };
}

export function buildDeepReviewHeroSegments(input: {
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

function getDeepRecurringScheduleReviewNote(
  frequency: PricingFrequency,
): string | null {
  return getPreferredCadenceReviewNote(frequency);
}

function getDeepRecurringScheduleExplanation(
  frequency: PricingFrequency,
): string | null {
  return getPreferredCadenceScheduleExplanation(frequency);
}

function getDeepRecurringPaymentExplanation(frequency: PricingFrequency): string | null {
  if (frequency === "once") return null;
  return PREFERRED_SCHEDULE_PAYMENT_EXPLANATION;
}

export type DeepCleaningCheckoutCopy = {
  whatHappensNext: readonly string[];
  restorationNote: string;
  amountHelper: (customerEmail: string, recurringNote: string | null) => string;
};

export function getDeepCleaningCheckoutCopy(
  serviceSlug: ServiceSlug | null,
): DeepCleaningCheckoutCopy | null {
  if (!isDeepCleaningSlug(serviceSlug)) return null;
  return {
    whatHappensNext: DEEP_CHECKOUT_WHAT_HAPPENS_NEXT,
    restorationNote:
      "Your home will receive detailed restoration-focused cleaning.",
    amountHelper: (customerEmail, recurringNote) => {
      if (recurringNote) return recurringNote;
      return `Paying as ${customerEmail} · Cleaner assignment begins after payment confirmation.`;
    },
  };
}

export const DEEP_CHECKOUT_WHAT_HAPPENS_NEXT = [
  "Your deep cleaning is scheduled",
  "Confirmation email to you",
  "Cleaner assignment for your home",
] as const;

export function getDeepWizardSummaryFrequencyLabel(serviceSlug: ServiceSlug | null): string | null {
  return isDeepCleaningSlug(serviceSlug) ? "Visit timing" : null;
}

export function getDeepWizardSummaryAddonsLabel(serviceSlug: ServiceSlug | null): string | null {
  return isDeepCleaningSlug(serviceSlug) ? "Detailed cleaning extras" : null;
}

export function getDeepWizardSummaryLocationLabel(serviceSlug: ServiceSlug | null): string | null {
  return isDeepCleaningSlug(serviceSlug) ? "Home" : null;
}

export function getDeepWizardSummaryEstimateHint(serviceSlug: ServiceSlug | null): string | null {
  return isDeepCleaningSlug(serviceSlug)
    ? "Estimate only — confirmed total on review."
    : null;
}

export function getDeepWizardCleanerFootnote(serviceSlug: ServiceSlug | null): string | null {
  return isDeepCleaningSlug(serviceSlug)
    ? "Cleaner preference is saved with your deep clean. Assignment finalizes after payment."
    : null;
}

/** Customer dashboard status — presentation only. */
export function customerDeepStatusLine(
  status: BookingStatus,
  defaultLine: string,
): string {
  switch (status) {
    case "pending_payment":
      return "Complete checkout to secure your deep cleaning slot.";
    case "confirmed":
      return "Preparing cleaner assignment for your home restoration clean.";
    case "pending_assignment":
      return "Finding a cleaner for your deep cleaning schedule.";
    case "assigned":
      return "Your deep cleaning cleaner is confirmed.";
    case "in_progress":
      return "Detailed cleaning in progress.";
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Home restoration complete — thank you for choosing us.";
    default:
      return defaultLine;
  }
}

export function customerDeepTimingHint(
  status: BookingStatus,
  defaultHint: string | null,
): string | null {
  switch (status) {
    case "pending_payment":
      return "Before your scheduled deep clean";
    case "confirmed":
    case "pending_assignment":
      return "Usually within a few minutes";
    case "assigned":
      return "Before your scheduled deep clean window";
    case "in_progress":
      return "During your scheduled window";
    default:
      return defaultHint;
  }
}

export function cleanerDeepJobDescription(
  status: BookingStatus,
  defaultDescription: string,
): string {
  switch (status) {
    case "assigned":
      return "Deep clean scheduled — review access, attention areas, and detailed extras before arrival.";
    case "in_progress":
      return "Deep cleaning in progress — prioritize buildup areas and detailed extras before marking complete.";
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Deep clean complete. Payout status is below.";
    default:
      return defaultDescription;
  }
}

export function cleanerDeepExpectedUpdate(
  status: BookingStatus,
  defaultUpdate: string | null,
): string | null {
  switch (status) {
    case "assigned":
      return "Start on site — follow access notes and deep-clean priorities";
    case "in_progress":
      return "Mark complete when restoration-focused cleaning is finished";
    default:
      return defaultUpdate;
  }
}

export type AdminDeepListBadge = {
  label: string;
  tone: "info" | "neutral" | "warning";
};

export function adminDeepOperationalBadges(input: {
  serviceLabel: string;
  scheduledStart?: string;
  frequency?: PricingFrequency | null;
}): AdminDeepListBadge[] {
  if (input.serviceLabel !== "Deep Cleaning") return [];

  const badges: AdminDeepListBadge[] = [{ label: "Deep clean", tone: "info" }];

  if (input.scheduledStart && isSameCalendarDayDeep(input.scheduledStart)) {
    badges.push({ label: "Scheduled today", tone: "warning" });
  }

  if (input.frequency && input.frequency !== "once") {
    badges.push({ label: "Recurring deep clean", tone: "neutral" });
  }

  return badges;
}

function isSameCalendarDayDeep(scheduledStart: string): boolean {
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
export function getDeepCleaningCustomerCopy(): {
  statusLine: typeof customerDeepStatusLine;
  timingHint: typeof customerDeepTimingHint;
} {
  return {
    statusLine: customerDeepStatusLine,
    timingHint: customerDeepTimingHint,
  };
}

/** Bundled cleaner copy for tests. */
export function getDeepCleaningCleanerCopy(): {
  jobDescription: typeof cleanerDeepJobDescription;
  expectedUpdate: typeof cleanerDeepExpectedUpdate;
} {
  return {
    jobDescription: cleanerDeepJobDescription,
    expectedUpdate: cleanerDeepExpectedUpdate,
  };
}

/** Bundled admin copy for tests. */
export function getDeepCleaningAdminCopy(): {
  listBadges: typeof adminDeepOperationalBadges;
} {
  return { listBadges: adminDeepOperationalBadges };
}
