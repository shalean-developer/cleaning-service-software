/**
 * Office Cleaning presentation copy and display helpers.
 * Does not affect pricing, payment, dispatch, lifecycle, or earnings behavior.
 */

import type { AddonSlug, PricingFrequency, ServiceSlug } from "@/features/pricing/server/types";
import {
  getPreferredCadenceReviewNote,
  getPreferredCadenceScheduleExplanation,
  PREFERRED_SCHEDULE_PAYMENT_EXPLANATION,
} from "./preferredScheduleCopy";
import type { OfficeSizeTier, OfficeWorkstationTier } from "./officeSizing";
import {
  formatOfficeSizingSummary,
  getOfficeSizeLabel,
  getOfficeWorkstationLabel,
} from "./officeSizing";
import { buildCompactReviewHeroSegments } from "./reviewDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { FrequencyStepOption } from "./constants";
import { FREQUENCY_STEP_OPTIONS } from "./constants";

export const OFFICE_CLEANING_SLUG = "office-cleaning" as const;

export function isOfficeCleaningSlug(
  serviceSlug: ServiceSlug | string | null | undefined,
): serviceSlug is typeof OFFICE_CLEANING_SLUG {
  return serviceSlug === OFFICE_CLEANING_SLUG;
}

/** Office steps use dedicated sizing/extras sections. hide the compact context chip strip. */
export function showWizardContextStripForService(
  serviceSlug: ServiceSlug | string | null | undefined,
): boolean {
  return !isOfficeCleaningSlug(serviceSlug);
}

/** Step 1 mobile card. commercial positioning. */
export const OFFICE_SERVICE_STEP_DESCRIPTION_MOBILE = "Reliable office workspace cleaning";

/** Step 1 desktop card. max two lines. */
export const OFFICE_SERVICE_STEP_DESCRIPTION_DESKTOP =
  "Reliable office cleaning for productive workspaces.";

/** Commercial cadence. frequency values unchanged. */
export const OFFICE_FREQUENCY_STEP_OPTIONS: FrequencyStepOption[] = [
  { value: "once", label: "One-time office clean", description: "Single workspace visit" },
  {
    value: "weekly",
    label: "Weekly",
    description: "First-booking preference. follow-ups arranged after",
  },
  {
    value: "biweekly",
    label: "Bi-weekly",
    description: "First-booking preference. follow-ups arranged after",
  },
  {
    value: "monthly",
    label: "Monthly",
    description: "First-booking preference. follow-ups arranged after",
  },
];

export type OfficeAddonStepGroup = {
  id: string;
  title: string;
  slugs: AddonSlug[];
};

/** Operational groupings for the office extras step. display only. */
export const OFFICE_ADDON_STEP_GROUPS: OfficeAddonStepGroup[] = [
  {
    id: "workspace-care",
    title: "Workspace care",
    slugs: ["boardroom-detailing", "carpet-spot-cleaning", "interior-windows"],
  },
  {
    id: "kitchen-hygiene",
    title: "Kitchen & hygiene",
    slugs: ["kitchenette-cleaning", "inside-fridge", "waste-removal", "sanitization-treatment"],
  },
  {
    id: "scheduling",
    title: "Scheduling",
    slugs: ["after-hours-cleaning"],
  },
];

/** Commercial add-on order. display only; matches group order above. */
export const OFFICE_ADDON_STEP_DISPLAY_ORDER: AddonSlug[] =
  OFFICE_ADDON_STEP_GROUPS.flatMap((g) => g.slugs);

export const OFFICE_ADDON_STEP_DESCRIPTIONS: Partial<Record<AddonSlug, string>> = {
  "boardroom-detailing": "Conference room surfaces and presentation areas.",
  "kitchenette-cleaning": "Shared kitchen counters, sinks, and appliances.",
  "inside-fridge": "Break-room or kitchenette fridge interior refreshed.",
  "carpet-spot-cleaning": "Targeted treatment for carpet marks in traffic areas.",
  "interior-windows": "Interior glass in common areas and meeting rooms.",
  "sanitization-treatment": "Disinfection for shared-touch office surfaces.",
  "waste-removal": "Shared-area bins emptied and liners replaced.",
  "after-hours-cleaning": "Cleaning scheduled outside office operating hours.",
};

export const OFFICE_ADDON_STEP_LABELS: Partial<Record<AddonSlug, string>> = {
  "inside-fridge": "Fridge cleaning",
  "interior-windows": "Window cleaning",
  "sanitization-treatment": "Sanitization treatment",
  "after-hours-cleaning": "After-hours cleaning",
};

export const OFFICE_ADDONS_SECTION_HINT =
  "Optional add-ons for meeting rooms, kitchenettes, and after-hours service.";

export type OfficeCleaningStepCopy = {
  mobileDescription: string;
  desktopDescription: string;
  accessNotes: {
    label: string;
    hint: string;
    placeholder: string;
  };
  detailsIntro: { title: string; description: string };
  homeSizeTitle: string;
  propertySizeFieldLabel: string;
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

export function getOfficeCleaningStepCopy(
  serviceSlug: ServiceSlug | null,
): OfficeCleaningStepCopy | null {
  if (!isOfficeCleaningSlug(serviceSlug)) return null;
  return {
    mobileDescription: OFFICE_SERVICE_STEP_DESCRIPTION_MOBILE,
    desktopDescription: OFFICE_SERVICE_STEP_DESCRIPTION_DESKTOP,
    accessNotes: {
      label: "Office access (optional)",
      hint: "Reception, security, floor or suite, parking, after-hours entry, and alarm instructions.",
      placeholder:
        "e.g. Reception on 2nd floor · Suite 4B · Park in visitor bay 3 · After-hours code 4521 · Disable alarm with 5678#",
    },
    detailsIntro: {
      title: "Workspace details",
      description:
        "Office size, workstations, and commercial extras that affect your office clean.",
    },
    homeSizeTitle: "Office size",
    propertySizeFieldLabel: "Office size",
    addonsTitle: "Extras",
    addonsHint: OFFICE_ADDONS_SECTION_HINT,
    notesTitle: "Workspace instructions",
    notesPlaceholder:
      "Reception instructions, desk zones to avoid, meeting rooms, kitchenette focus, or after-hours coordination.",
    frequencyTitle: "Service cadence",
    cleaner: {
      title: "Choose your office cleaning professional",
      subtitle:
        "Experienced cleaners for commercial environments. ideal for recurring workspace maintenance.",
      bestAvailableTitle: "Best available cleaner",
      bestAvailableDescription:
        "Fastest assignment. we match an eligible cleaner experienced in office and workspace cleaning.",
      selectedHint:
        "Your selected cleaner is offered first. Ideal for recurring office maintenance and consistent workspace standards.",
      disclosureBestAvailable:
        "Highest-rated eligible cleaner for your workspace, area, and scheduled service window.",
      disclosureSelected:
        "Offered to them first after payment. If unavailable, we assign the next best eligible match. your office clean stays booked.",
    },
  };
}

export function getOfficeFrequencyStepOptions(
  serviceSlug: ServiceSlug | null,
): FrequencyStepOption[] | null {
  return isOfficeCleaningSlug(serviceSlug) ? OFFICE_FREQUENCY_STEP_OPTIONS : null;
}

export function getOfficeFrequencyLabel(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null,
): string | null {
  if (!isOfficeCleaningSlug(serviceSlug)) return null;
  return (
    OFFICE_FREQUENCY_STEP_OPTIONS.find((o) => o.value === frequency)?.label ?? frequency
  );
}

export function getOfficeFrequencySectionTitle(serviceSlug: ServiceSlug | null): string | null {
  return isOfficeCleaningSlug(serviceSlug) ? "Service cadence" : null;
}

export function getOfficeScheduleStepHelperCopy(
  serviceSlug: ServiceSlug | null,
  extendedWindowEnabled: boolean,
): string | null {
  if (!isOfficeCleaningSlug(serviceSlug)) return null;
  if (extendedWindowEnabled) {
    return "Book up to 90 days ahead.";
  }
  return "Schedule around office hours or after-hours access. Recurring office cleaning helps maintain a clean, productive workspace.";
}

export type OfficeCleaningReviewCopy = {
  heroSegments: (input: {
    scheduleLabel: string;
    locationLabel: string;
    officeSizeLabel: string | null;
    workstationLabel: string | null;
  }) => string[];
  addonsSectionLabel: string;
  propertySectionTitle: string;
  workspaceSizeRowLabel: string;
  nextStepsNote: string;
  confirmationCopy: string;
  accessNotesLabel: string;
  recurringScheduleReviewNote: (frequency: PricingFrequency) => string | null;
  recurringScheduleExplanation: (frequency: PricingFrequency) => string | null;
  recurringPaymentExplanation: (frequency: PricingFrequency) => string | null;
};

export function getOfficeCleaningReviewCopy(
  serviceSlug: ServiceSlug | null,
): OfficeCleaningReviewCopy | null {
  if (!isOfficeCleaningSlug(serviceSlug)) return null;
  return {
    heroSegments: buildOfficeReviewHeroSegments,
    addonsSectionLabel: "Commercial cleaning extras",
    propertySectionTitle: "Workspace details",
    workspaceSizeRowLabel: "Office & workstations",
    nextStepsNote:
      "Next: secure Paystack checkout. Cleaner assignment begins after payment confirmation.",
    confirmationCopy:
      "I confirm these workspace details are correct and I'm ready for secure payment.",
    accessNotesLabel: "Business access instructions",
    recurringScheduleReviewNote: getOfficeRecurringScheduleReviewNote,
    recurringScheduleExplanation: getOfficeRecurringScheduleExplanation,
    recurringPaymentExplanation: getOfficeRecurringPaymentExplanation,
  };
}

export function buildOfficeReviewHeroSegments(input: {
  scheduleLabel: string;
  locationLabel: string;
  officeSizeLabel: string | null;
  workstationLabel: string | null;
}): string[] {
  return buildCompactReviewHeroSegments(
    input.scheduleLabel,
    input.locationLabel,
    input.officeSizeLabel,
    input.workstationLabel,
  );
}

function getOfficeRecurringScheduleReviewNote(
  frequency: PricingFrequency,
): string | null {
  return getPreferredCadenceReviewNote(frequency);
}

function getOfficeRecurringScheduleExplanation(
  frequency: PricingFrequency,
): string | null {
  return getPreferredCadenceScheduleExplanation(frequency);
}

function getOfficeRecurringPaymentExplanation(frequency: PricingFrequency): string | null {
  if (frequency === "once") return null;
  return PREFERRED_SCHEDULE_PAYMENT_EXPLANATION;
}

export type OfficeCleaningCheckoutCopy = {
  whatHappensNext: readonly string[];
  workspaceNote: string;
  amountHelper: (customerEmail: string, recurringNote: string | null) => string;
};

export function getOfficeCleaningCheckoutCopy(
  serviceSlug: ServiceSlug | null,
): OfficeCleaningCheckoutCopy | null {
  if (!isOfficeCleaningSlug(serviceSlug)) return null;
  return {
    whatHappensNext: OFFICE_CHECKOUT_WHAT_HAPPENS_NEXT,
    workspaceNote: "We'll help maintain a clean and productive workspace after payment.",
    amountHelper: (customerEmail, recurringNote) => {
      if (recurringNote) return recurringNote;
      return `Paying as ${customerEmail} · Office cleaner assignment begins after payment.`;
    },
  };
}

export const OFFICE_CHECKOUT_WHAT_HAPPENS_NEXT = [
  "Office cleaning scheduled",
  "Confirmation email to you",
  "Cleaner assignment for your workspace",
] as const;

export function getOfficeWizardSummaryFrequencyLabel(serviceSlug: ServiceSlug | null): string | null {
  return isOfficeCleaningSlug(serviceSlug) ? "Service cadence" : null;
}

export function getOfficeWizardSummaryAddonsLabel(serviceSlug: ServiceSlug | null): string | null {
  return isOfficeCleaningSlug(serviceSlug) ? "Commercial extras" : null;
}

export function getOfficeWizardSummaryLocationLabel(serviceSlug: ServiceSlug | null): string | null {
  return isOfficeCleaningSlug(serviceSlug) ? "Workspace" : null;
}

export function getOfficeWizardSummaryEstimateHint(serviceSlug: ServiceSlug | null): string | null {
  return isOfficeCleaningSlug(serviceSlug)
    ? "Estimate only. confirmed total on review."
    : null;
}

export function getOfficeWizardCleanerFootnote(serviceSlug: ServiceSlug | null): string | null {
  return isOfficeCleaningSlug(serviceSlug)
    ? "Cleaner preference is saved with your office clean. Assignment finalizes after payment."
    : null;
}

/** Format office size + workstations for review, sidebar, and summaries. */
export function formatOfficeWorkspaceSizeSummary(
  propertySizeSqm: number | null,
  officeSizeTier: OfficeSizeTier | null = null,
  officeWorkstations: OfficeWorkstationTier | null = null,
): string | null {
  return formatOfficeSizingSummary(officeSizeTier, officeWorkstations, propertySizeSqm);
}

/** Optional booking metadata for operational context. does not affect pricing. */
export function buildOfficeBookingDetailsMetadata(input: {
  officeSizeTier: OfficeSizeTier | null;
  officeWorkstations: OfficeWorkstationTier | null;
}): Record<string, string> | null {
  if (!input.officeSizeTier || !input.officeWorkstations) return null;
  return {
    officeSizeTier: input.officeSizeTier,
    officeSizeLabel: getOfficeSizeLabel(input.officeSizeTier),
    officeWorkstations: input.officeWorkstations,
    officeWorkstationsLabel: getOfficeWorkstationLabel(input.officeWorkstations),
  };
}

/** Customer dashboard status. presentation only. */
export function customerOfficeStatusLine(
  status: BookingStatus,
  defaultLine: string,
): string {
  switch (status) {
    case "pending_payment":
      return "Complete checkout to secure your workspace cleaning slot.";
    case "confirmed":
      return "Preparing cleaner assignment for your office schedule.";
    case "pending_assignment":
      return "Finding a cleaner for your workspace maintenance schedule.";
    case "assigned":
      return "Your office cleaning professional is confirmed.";
    case "in_progress":
      return "Commercial cleaning in progress.";
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Workspace refresh complete. professional environment maintained.";
    default:
      return defaultLine;
  }
}

export function customerOfficeTimingHint(
  status: BookingStatus,
  defaultHint: string | null,
): string | null {
  switch (status) {
    case "pending_payment":
      return "Around your scheduled office service window";
    case "confirmed":
    case "pending_assignment":
      return "Usually within a few minutes";
    case "assigned":
      return "Before your scheduled workspace clean";
    case "in_progress":
      return "During your scheduled service window";
    default:
      return defaultHint;
  }
}

export function cleanerOfficeJobDescription(
  status: BookingStatus,
  defaultDescription: string,
): string {
  switch (status) {
    case "assigned":
      return "Office clean scheduled. review business access and workspace instructions before arrival.";
    case "in_progress":
      return "Workspace cleaning in progress. maintain professional standards before marking complete.";
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Office clean complete. Payout status is below.";
    default:
      return defaultDescription;
  }
}

export function cleanerOfficeExpectedUpdate(
  status: BookingStatus,
  defaultUpdate: string | null,
): string | null {
  switch (status) {
    case "assigned":
      return "Start on site. follow office access and workspace instructions";
    case "in_progress":
      return "Mark complete when the workspace meets professional standards";
    default:
      return defaultUpdate;
  }
}

export type AdminOfficeListBadge = {
  label: string;
  tone: "info" | "neutral" | "warning";
};

export function adminOfficeOperationalBadges(input: {
  serviceLabel: string;
  scheduledStart?: string;
  frequency?: PricingFrequency | null;
}): AdminOfficeListBadge[] {
  if (input.serviceLabel !== "Office Cleaning") return [];

  const badges: AdminOfficeListBadge[] = [{ label: "Office clean", tone: "info" }];

  if (input.scheduledStart && isSameCalendarDayOffice(input.scheduledStart)) {
    badges.push({ label: "Service today", tone: "warning" });
  }

  if (input.frequency && input.frequency !== "once") {
    badges.push({ label: "Recurring workspace", tone: "neutral" });
  }

  return badges;
}

function isSameCalendarDayOffice(scheduledStart: string): boolean {
  const start = new Date(scheduledStart);
  if (Number.isNaN(start.getTime())) return false;
  const now = new Date();
  return (
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate()
  );
}

/** Bundled customer-facing copy for tests. */
export function getOfficeCleaningCustomerCopy(): {
  statusLine: typeof customerOfficeStatusLine;
  timingHint: typeof customerOfficeTimingHint;
} {
  return {
    statusLine: customerOfficeStatusLine,
    timingHint: customerOfficeTimingHint,
  };
}

/** Bundled cleaner copy for tests. */
export function getOfficeCleaningCleanerCopy(): {
  jobDescription: typeof cleanerOfficeJobDescription;
  expectedUpdate: typeof cleanerOfficeExpectedUpdate;
} {
  return {
    jobDescription: cleanerOfficeJobDescription,
    expectedUpdate: cleanerOfficeExpectedUpdate,
  };
}

/** Bundled admin copy for tests. */
export function getOfficeCleaningAdminCopy(): {
  listBadges: typeof adminOfficeOperationalBadges;
} {
  return { listBadges: adminOfficeOperationalBadges };
}
