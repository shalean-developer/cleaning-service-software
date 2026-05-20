/**
 * Airbnb Cleaning presentation copy and display helpers.
 * Does not affect pricing, payment, dispatch, or lifecycle behavior.
 */

import type { AddonSlug, PricingFrequency, ServiceSlug } from "@/features/pricing/server/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { FrequencyStepOption } from "./constants";
import { FREQUENCY_STEP_OPTIONS } from "./constants";
import {
  buildDeepReviewHeroSegments,
  getDeepCleaningCheckoutCopy,
  getDeepCleaningReviewCopy,
  getDeepCleaningStepCopy,
  getDeepFrequencyLabel,
  getDeepFrequencySectionTitle,
  getDeepFrequencyStepOptions,
  getDeepScheduleStepHelperCopy,
  getDeepWizardCleanerFootnote,
  getDeepWizardSummaryAddonsLabel,
  getDeepWizardSummaryEstimateHint,
  getDeepWizardSummaryFrequencyLabel,
  getDeepWizardSummaryLocationLabel,
  isDeepCleaningSlug,
} from "./deepCleaningDisplay";
import {
  buildCarpetReviewHeroSegments,
  getCarpetCleaningCheckoutCopy,
  getCarpetCleaningReviewCopy,
  getCarpetCleaningStepCopy,
  getCarpetFrequencyLabel,
  getCarpetFrequencySectionTitle,
  getCarpetFrequencyStepOptions,
  getCarpetScheduleStepHelperCopy,
  getCarpetWizardCleanerFootnote,
  getCarpetWizardSummaryAddonsLabel,
  getCarpetWizardSummaryEstimateHint,
  getCarpetWizardSummaryFrequencyLabel,
  getCarpetWizardSummaryLocationLabel,
  isCarpetCleaningSlug,
} from "./carpetCleaningDisplay";
import {
  buildMovingReviewHeroSegments,
  getMovingCleaningCheckoutCopy,
  getMovingCleaningReviewCopy,
  getMovingCleaningStepCopy,
  getMovingFrequencyLabel,
  getMovingFrequencySectionTitle,
  getMovingFrequencyStepOptions,
  getMovingScheduleStepHelperCopy,
  getMovingWizardCleanerFootnote,
  getMovingWizardSummaryAddonsLabel,
  getMovingWizardSummaryEstimateHint,
  getMovingWizardSummaryFrequencyLabel,
  getMovingWizardSummaryLocationLabel,
  isMovingCleaningSlug,
  MOVING_ADDONS_SECTION_HINT,
  MOVING_CHECKOUT_WHAT_HAPPENS_NEXT,
} from "./movingCleaningDisplay";
import {
  buildOfficeReviewHeroSegments,
  getOfficeCleaningCheckoutCopy,
  getOfficeCleaningReviewCopy,
  getOfficeCleaningStepCopy,
  getOfficeFrequencyLabel,
  getOfficeFrequencySectionTitle,
  getOfficeFrequencyStepOptions,
  getOfficeScheduleStepHelperCopy,
  getOfficeWizardCleanerFootnote,
  getOfficeWizardSummaryAddonsLabel,
  getOfficeWizardSummaryEstimateHint,
  getOfficeWizardSummaryFrequencyLabel,
  getOfficeWizardSummaryLocationLabel,
  isOfficeCleaningSlug,
  OFFICE_ADDONS_SECTION_HINT,
} from "./officeCleaningDisplay";

export const AIRBNB_CLEANING_SLUG = "airbnb-cleaning" as const;

export function isAirbnbCleaningSlug(
  serviceSlug: ServiceSlug | string | null | undefined,
): serviceSlug is typeof AIRBNB_CLEANING_SLUG {
  return serviceSlug === AIRBNB_CLEANING_SLUG;
}

/** Step 1 mobile card — host-focused. */
export const AIRBNB_SERVICE_STEP_DESCRIPTION_MOBILE = "Guest-ready turnover";

/** Step 1 desktop card — max two lines. */
export const AIRBNB_SERVICE_STEP_DESCRIPTION_DESKTOP =
  "Reliable reset between guests — kitchens, baths, and key spaces guest-ready.";

/** Host-oriented frequency cards — values unchanged. */
export const AIRBNB_FREQUENCY_STEP_OPTIONS: FrequencyStepOption[] = [
  { value: "once", label: "Single turnover", description: "One checkout clean" },
  { value: "weekly", label: "Weekly", description: "Scheduled property maintenance" },
  { value: "biweekly", label: "Bi-weekly", description: "Every two weeks" },
  { value: "monthly", label: "Monthly", description: "Light turnover upkeep" },
];

export function getFrequencyStepOptions(
  serviceSlug: ServiceSlug | null,
): FrequencyStepOption[] {
  const office = getOfficeFrequencyStepOptions(serviceSlug);
  if (office) return office;
  const moving = getMovingFrequencyStepOptions(serviceSlug);
  if (moving) return moving;
  const deep = getDeepFrequencyStepOptions(serviceSlug);
  if (deep) return deep;
  const carpet = getCarpetFrequencyStepOptions(serviceSlug);
  if (carpet) return carpet;
  return isAirbnbCleaningSlug(serviceSlug)
    ? AIRBNB_FREQUENCY_STEP_OPTIONS
    : FREQUENCY_STEP_OPTIONS;
}

export function getFrequencyLabel(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null = null,
): string {
  const office = getOfficeFrequencyLabel(frequency, serviceSlug);
  if (office) return office;
  const moving = getMovingFrequencyLabel(frequency, serviceSlug);
  if (moving) return moving;
  const deep = getDeepFrequencyLabel(frequency, serviceSlug);
  if (deep) return deep;
  const carpet = getCarpetFrequencyLabel(frequency, serviceSlug);
  if (carpet) return carpet;
  return (
    getFrequencyStepOptions(serviceSlug).find((option) => option.value === frequency)?.label ??
    frequency
  );
}

export function getFrequencySectionTitle(serviceSlug: ServiceSlug | null): string {
  const office = getOfficeFrequencySectionTitle(serviceSlug);
  if (office) return office;
  const moving = getMovingFrequencySectionTitle(serviceSlug);
  if (moving) return moving;
  const deep = getDeepFrequencySectionTitle(serviceSlug);
  if (deep) return deep;
  const carpet = getCarpetFrequencySectionTitle(serviceSlug);
  if (carpet) return carpet;
  return isAirbnbCleaningSlug(serviceSlug) ? "Turnover cadence" : "Visit frequency";
}

/** Airbnb add-on order — turnover-relevant first. */
export const AIRBNB_ADDON_STEP_DISPLAY_ORDER: AddonSlug[] = [
  "balcony",
  "laundry",
  "inside-fridge",
  "inside-oven",
  "inside-cabinets",
  "interior-windows",
  "interior-walls",
];

/** Display-only host-oriented add-on subtitles. */
export const AIRBNB_ADDON_STEP_DESCRIPTIONS: Partial<Record<AddonSlug, string>> = {
  balcony: "Balcony sweep and outdoor reset for guest arrival.",
  laundry: "Wash, dry, fold — linen refresh for the next guest.",
  "inside-fridge": "Fridge shelves and drawers checked and refreshed.",
  "inside-oven": "Oven interior ready for the next booking.",
  "inside-cabinets": "Cupboard interiors wiped for a tidy handover.",
  "interior-windows": "Interior glass cleaned for a bright welcome.",
  "interior-walls": "Spot-clean marks on accessible walls.",
};

export const AIRBNB_ADDON_STEP_LABELS: Partial<Record<AddonSlug, string>> = {
  laundry: "Linen & towel refresh",
  balcony: "Balcony reset",
  "inside-fridge": "Fridge check",
};

export function getDetailsStepIntro(serviceSlug: ServiceSlug | null): {
  title: string;
  description: string;
} {
  const office = getOfficeCleaningStepCopy(serviceSlug);
  if (office) return office.detailsIntro;
  const moving = getMovingCleaningStepCopy(serviceSlug);
  if (moving) return moving.detailsIntro;
  const deep = getDeepCleaningStepCopy(serviceSlug);
  if (deep) return deep.detailsIntro;
  const carpet = getCarpetCleaningStepCopy(serviceSlug);
  if (carpet) return carpet.detailsIntro;
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return {
      title: "Property & turnover options",
      description:
        "Bed and bath count, turnover cadence, and extras that affect guest-ready preparation.",
    };
  }
  return {
    title: "Your home & options",
    description: "Tell us what affects time, supplies, and support.",
  };
}

export function getHomeSizeSectionTitle(serviceSlug: ServiceSlug | null): string {
  const office = getOfficeCleaningStepCopy(serviceSlug);
  if (office) return office.homeSizeTitle;
  const moving = getMovingCleaningStepCopy(serviceSlug);
  if (moving) return moving.homeSizeTitle;
  const deep = getDeepCleaningStepCopy(serviceSlug);
  if (deep) return deep.homeSizeTitle;
  const carpet = getCarpetCleaningStepCopy(serviceSlug);
  if (carpet) return carpet.homeSizeTitle;
  return isAirbnbCleaningSlug(serviceSlug) ? "Property size" : "Home size";
}

export function getAddonsSectionTitle(serviceSlug: ServiceSlug | null): string {
  const office = getOfficeCleaningStepCopy(serviceSlug);
  if (office) return office.addonsTitle;
  const moving = getMovingCleaningStepCopy(serviceSlug);
  if (moving) return moving.addonsTitle;
  const deep = getDeepCleaningStepCopy(serviceSlug);
  if (deep) return deep.addonsTitle;
  const carpet = getCarpetCleaningStepCopy(serviceSlug);
  if (carpet) return carpet.addonsTitle;
  return isAirbnbCleaningSlug(serviceSlug) ? "Turnover extras" : "Add-ons";
}

export function getAddonsSectionHint(serviceSlug: ServiceSlug | null): string | null {
  const office = getOfficeCleaningStepCopy(serviceSlug);
  if (office) return office.addonsHint;
  const moving = getMovingCleaningStepCopy(serviceSlug);
  if (moving) return moving.addonsHint;
  const deep = getDeepCleaningStepCopy(serviceSlug);
  if (deep) return deep.addonsHint;
  const carpet = getCarpetCleaningStepCopy(serviceSlug);
  if (carpet) return carpet.addonsHint;
  return null;
}

export function getHostNotesSectionTitle(serviceSlug: ServiceSlug | null): string {
  const office = getOfficeCleaningStepCopy(serviceSlug);
  if (office) return office.notesTitle;
  const moving = getMovingCleaningStepCopy(serviceSlug);
  if (moving) return moving.notesTitle;
  const deep = getDeepCleaningStepCopy(serviceSlug);
  if (deep) return deep.notesTitle;
  const carpet = getCarpetCleaningStepCopy(serviceSlug);
  if (carpet) return carpet.notesTitle;
  return isAirbnbCleaningSlug(serviceSlug) ? "Host instructions" : "Notes";
}

export function getHostNotesPlaceholder(serviceSlug: ServiceSlug | null): string {
  const office = getOfficeCleaningStepCopy(serviceSlug);
  if (office) return office.notesPlaceholder;
  const moving = getMovingCleaningStepCopy(serviceSlug);
  if (moving) return moving.notesPlaceholder;
  const deep = getDeepCleaningStepCopy(serviceSlug);
  if (deep) return deep.notesPlaceholder;
  const carpet = getCarpetCleaningStepCopy(serviceSlug);
  if (carpet) return carpet.notesPlaceholder;
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return "Guest focus areas, linen location, restocking notes, or turnover priorities.";
  }
  return "Gate code, pets, focus areas, or access instructions.";
}

export type AccessNotesFieldCopy = {
  label: string;
  hint: string;
  placeholder: string;
};

export function getAccessNotesFieldCopy(serviceSlug: ServiceSlug | null): AccessNotesFieldCopy {
  const office = getOfficeCleaningStepCopy(serviceSlug);
  if (office) return office.accessNotes;
  const moving = getMovingCleaningStepCopy(serviceSlug);
  if (moving) return moving.accessNotes;
  const deep = getDeepCleaningStepCopy(serviceSlug);
  if (deep) return deep.accessNotes;
  const carpet = getCarpetCleaningStepCopy(serviceSlug);
  if (carpet) return carpet.accessNotes;
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return {
      label: "Property access (optional)",
      hint: "Lockbox code, concierge or building access, parking, and alarm instructions.",
      placeholder:
        "e.g. Lockbox on gate post, code 1234 · Park in bay 12 · Disable alarm with 5678#",
    };
  }
  return {
    label: "Access notes (optional)",
    hint: "",
    placeholder: "Gate code, building access, parking, or entry instructions.",
  };
}

export function getAccessNotesReviewLabel(serviceSlug: ServiceSlug | null): string {
  const officeReview = getOfficeCleaningReviewCopy(serviceSlug);
  if (officeReview) return officeReview.accessNotesLabel;
  const movingReview = getMovingCleaningReviewCopy(serviceSlug);
  if (movingReview) return movingReview.accessNotesLabel;
  const deepReview = getDeepCleaningReviewCopy(serviceSlug);
  if (deepReview) return deepReview.accessNotesLabel;
  const carpetReview = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpetReview) return carpetReview.accessNotesLabel;
  return isAirbnbCleaningSlug(serviceSlug) ? "Host access instructions" : "Access notes";
}

export function getScheduleStepHelperCopy(
  serviceSlug: ServiceSlug | null,
  extendedWindowEnabled: boolean,
): string {
  const office = getOfficeScheduleStepHelperCopy(serviceSlug, extendedWindowEnabled);
  if (office) return office;
  const moving = getMovingScheduleStepHelperCopy(serviceSlug, extendedWindowEnabled);
  if (moving) return moving;
  const deep = getDeepScheduleStepHelperCopy(serviceSlug, extendedWindowEnabled);
  if (deep) return deep;
  const carpet = getCarpetScheduleStepHelperCopy(serviceSlug, extendedWindowEnabled);
  if (carpet) return carpet;
  if (isAirbnbCleaningSlug(serviceSlug)) {
    if (extendedWindowEnabled) {
      return "Book turnovers up to 90 days ahead. Same-day slots depend on cleaner availability — we assign closer to check-in when needed.";
    }
    return "Pick your turnover date and arrival window. Same-day requests are subject to availability — book early before the next guest check-in.";
  }
  if (extendedWindowEnabled) {
    return "Book up to 90 days ahead. Cleaner assignment happens closer to your service date.";
  }
  return "Choose your preferred service date. Future bookings are assigned closer to the service date.";
}

export type CleanerStepCopy = {
  title: string;
  subtitle: string;
  bestAvailableTitle: string;
  bestAvailableDescription: string;
  selectedHint: string;
  disclosureBestAvailable: string;
  disclosureSelected: string;
};

export function getCleanerStepCopy(serviceSlug: ServiceSlug | null): CleanerStepCopy {
  const office = getOfficeCleaningStepCopy(serviceSlug);
  if (office) return office.cleaner;
  const moving = getMovingCleaningStepCopy(serviceSlug);
  if (moving) return moving.cleaner;
  const deep = getDeepCleaningStepCopy(serviceSlug);
  if (deep) return deep.cleaner;
  const carpet = getCarpetCleaningStepCopy(serviceSlug);
  if (carpet) return carpet.cleaner;
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return {
      title: "Choose your turnover cleaner",
      subtitle: "Returning cleaners help keep guest-ready standards consistent.",
      bestAvailableTitle: "Best available cleaner",
      bestAvailableDescription:
        "Fastest assignment — we match an eligible cleaner familiar with turnover work.",
      selectedHint:
        "We offer your selected cleaner first. Returning cleaners help maintain consistent guest standards at your property.",
      disclosureBestAvailable:
        "We assign the highest-rated eligible cleaner for your property, area, and turnover window.",
      disclosureSelected:
        "Your selected cleaner is offered the job first after payment. If unavailable, we assign the next best eligible match — your turnover is still fully booked.",
    };
  }
  return {
    title: "Choose your cleaner",
    subtitle: "Recommended for speed — or pick someone you prefer.",
    bestAvailableTitle: "Best available cleaner",
    bestAvailableDescription:
      "Fastest assignment — we match the top eligible cleaner. No need to choose manually.",
    selectedHint:
      "We'll try your selected cleaner first. If they can't take the job, we'll assign the next best eligible match.",
    disclosureBestAvailable:
      "Highest-rated cleaner who is eligible for your service, area, and time.",
    disclosureSelected:
      "We offer the job to them first after payment. If they decline or are unavailable, we continue with the next best match — you are still fully booked.",
  };
}

/** Review hero — operational order for hosts. */
export function buildAirbnbReviewHeroSegments(input: {
  scheduleLabel: string;
  locationLabel: string;
  bedBathSummary: string | null;
  addonSummary: string | null;
  frequencyLabel: string;
}): string[] {
  return [
    input.scheduleLabel,
    input.locationLabel !== "\u2014" ? input.locationLabel : null,
    input.bedBathSummary,
    input.addonSummary,
    input.frequencyLabel,
  ].filter(Boolean) as string[];
}

export function getReviewNextStepsNote(serviceSlug: ServiceSlug | null): string {
  const officeReview = getOfficeCleaningReviewCopy(serviceSlug);
  if (officeReview) return officeReview.nextStepsNote;
  const movingReview = getMovingCleaningReviewCopy(serviceSlug);
  if (movingReview) return movingReview.nextStepsNote;
  const deepReview = getDeepCleaningReviewCopy(serviceSlug);
  if (deepReview) return deepReview.nextStepsNote;
  const carpetReview = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpetReview) return carpetReview.nextStepsNote;
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return "Next: secure Paystack checkout. Cleaner assignment begins immediately after payment.";
  }
  return "Next: secure Paystack checkout, then we assign a cleaner to your booking.";
}

export function getReviewConfirmationCopy(serviceSlug: ServiceSlug | null): string {
  const officeReview = getOfficeCleaningReviewCopy(serviceSlug);
  if (officeReview) return officeReview.confirmationCopy;
  const movingReview = getMovingCleaningReviewCopy(serviceSlug);
  if (movingReview) return movingReview.confirmationCopy;
  const deepReview = getDeepCleaningReviewCopy(serviceSlug);
  if (deepReview) return deepReview.confirmationCopy;
  const carpetReview = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpetReview) return carpetReview.confirmationCopy;
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return "I confirm these turnover details are correct and I'm ready for secure payment.";
  }
  return "I confirm these details are correct and I'm ready for secure payment.";
}

export function getReviewPropertySectionTitle(serviceSlug: ServiceSlug | null): string {
  const officeReview = getOfficeCleaningReviewCopy(serviceSlug);
  if (officeReview) return officeReview.propertySectionTitle;
  const movingReview = getMovingCleaningReviewCopy(serviceSlug);
  if (movingReview) return movingReview.propertySectionTitle;
  const deepReview = getDeepCleaningReviewCopy(serviceSlug);
  if (deepReview) return deepReview.propertySectionTitle;
  const carpetReview = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpetReview) return carpetReview.propertySectionTitle;
  return "Property details";
}

export function getReviewBedroomsRowLabel(serviceSlug: ServiceSlug | null): string {
  const carpetReview = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpetReview) return carpetReview.zonesRowLabel;
  return "Bedrooms";
}

export {
  buildCarpetReviewHeroSegments,
  buildDeepReviewHeroSegments,
  buildMovingReviewHeroSegments,
  buildOfficeReviewHeroSegments,
  MOVING_CHECKOUT_WHAT_HAPPENS_NEXT,
  MOVING_ADDONS_SECTION_HINT,
  OFFICE_ADDONS_SECTION_HINT,
  isOfficeCleaningSlug,
};

export function getRecurringScheduleReviewNote(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null = null,
): string | null {
  const officeReview = getOfficeCleaningReviewCopy(serviceSlug);
  if (officeReview) return officeReview.recurringScheduleReviewNote(frequency);
  const movingReview = getMovingCleaningReviewCopy(serviceSlug);
  if (movingReview) return movingReview.recurringScheduleReviewNote(frequency);
  const deepReview = getDeepCleaningReviewCopy(serviceSlug);
  if (deepReview) return deepReview.recurringScheduleReviewNote(frequency);
  const carpetReview = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpetReview) return carpetReview.recurringScheduleReviewNote(frequency);
  if (!isAirbnbCleaningSlug(serviceSlug)) return null;
  switch (frequency) {
    case "weekly":
      return "Repeats weekly on this turnover day and arrival window.";
    case "biweekly":
      return "Repeats every 2 weeks on this turnover schedule.";
    case "monthly":
      return "Repeats monthly on this turnover schedule.";
    default:
      return null;
  }
}

export function getRecurringScheduleExplanation(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null = null,
): string | null {
  const officeReview = getOfficeCleaningReviewCopy(serviceSlug);
  if (officeReview) return officeReview.recurringScheduleExplanation(frequency);
  const movingReview = getMovingCleaningReviewCopy(serviceSlug);
  if (movingReview) return movingReview.recurringScheduleExplanation(frequency);
  const deepReview = getDeepCleaningReviewCopy(serviceSlug);
  if (deepReview) return deepReview.recurringScheduleExplanation(frequency);
  const carpetReview = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpetReview) return carpetReview.recurringScheduleExplanation(frequency);
  if (!isAirbnbCleaningSlug(serviceSlug)) return null;
  switch (frequency) {
    case "weekly":
      return "Repeats every week on the turnover day and arrival time you selected.";
    case "biweekly":
      return "Repeats every two weeks on the turnover day and arrival time you selected.";
    case "monthly":
      return "Repeats monthly on the turnover day and arrival time you selected.";
    default:
      return null;
  }
}

export function getRecurringPaymentExplanation(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null = null,
): string | null {
  if (frequency === "once") return null;
  const officeReview = getOfficeCleaningReviewCopy(serviceSlug);
  if (officeReview) return officeReview.recurringPaymentExplanation(frequency);
  const movingReview = getMovingCleaningReviewCopy(serviceSlug);
  if (movingReview) return movingReview.recurringPaymentExplanation(frequency);
  const deepReview = getDeepCleaningReviewCopy(serviceSlug);
  if (deepReview) return deepReview.recurringPaymentExplanation(frequency);
  const carpetReview = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpetReview) return carpetReview.recurringPaymentExplanation(frequency);
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return "Today's payment secures this turnover only. We'll confirm your recurring host schedule after payment; future visits are arranged in your account.";
  }
  return null;
}

export const AIRBNB_CHECKOUT_WHAT_HAPPENS_NEXT = [
  "Turnover booking confirmed",
  "Confirmation email to you",
  "Cleaner assignment for your property",
] as const;

export function getCheckoutGuestReadyNote(serviceSlug: ServiceSlug | null): string | null {
  const officeCheckout = getOfficeCleaningCheckoutCopy(serviceSlug);
  if (officeCheckout) return officeCheckout.workspaceNote;
  const movingCheckout = getMovingCleaningCheckoutCopy(serviceSlug);
  if (movingCheckout) return movingCheckout.guestReadyNote;
  const deepCheckout = getDeepCleaningCheckoutCopy(serviceSlug);
  if (deepCheckout) return deepCheckout.restorationNote;
  const carpetCheckout = getCarpetCleaningCheckoutCopy(serviceSlug);
  if (carpetCheckout) return carpetCheckout.floorCareNote;
  if (!isAirbnbCleaningSlug(serviceSlug)) return null;
  return "Your property will be prepared before the next guest arrival.";
}

export function getCheckoutWhatHappensNext(
  serviceSlug: ServiceSlug | null,
): readonly string[] {
  const officeCheckout = getOfficeCleaningCheckoutCopy(serviceSlug);
  if (officeCheckout) return officeCheckout.whatHappensNext;
  const movingCheckout = getMovingCleaningCheckoutCopy(serviceSlug);
  if (movingCheckout) return movingCheckout.whatHappensNext;
  const deepCheckout = getDeepCleaningCheckoutCopy(serviceSlug);
  if (deepCheckout) return deepCheckout.whatHappensNext;
  const carpetCheckout = getCarpetCleaningCheckoutCopy(serviceSlug);
  if (carpetCheckout) return carpetCheckout.whatHappensNext;
  if (isAirbnbCleaningSlug(serviceSlug)) return AIRBNB_CHECKOUT_WHAT_HAPPENS_NEXT;
  return ["Booking confirmation", "Confirmation email", "Cleaner assignment"];
}

export function getCheckoutAmountHelper(
  serviceSlug: ServiceSlug | null,
  customerEmail: string,
  recurringNote: string | null,
): string {
  if (recurringNote) return recurringNote;
  const officeCheckout = getOfficeCleaningCheckoutCopy(serviceSlug);
  if (officeCheckout) return officeCheckout.amountHelper(customerEmail, recurringNote);
  const movingCheckout = getMovingCleaningCheckoutCopy(serviceSlug);
  if (movingCheckout) return movingCheckout.amountHelper(customerEmail, recurringNote);
  const deepCheckout = getDeepCleaningCheckoutCopy(serviceSlug);
  if (deepCheckout) return deepCheckout.amountHelper(customerEmail, recurringNote);
  const carpetCheckout = getCarpetCleaningCheckoutCopy(serviceSlug);
  if (carpetCheckout) return carpetCheckout.amountHelper(customerEmail, recurringNote);
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return `Paying as ${customerEmail} · Cleaner assignment begins after payment.`;
  }
  return `Paying as ${customerEmail}`;
}

export function getWizardSummaryFrequencyLabel(serviceSlug: ServiceSlug | null): string {
  const office = getOfficeWizardSummaryFrequencyLabel(serviceSlug);
  if (office) return office;
  const moving = getMovingWizardSummaryFrequencyLabel(serviceSlug);
  if (moving) return moving;
  const deep = getDeepWizardSummaryFrequencyLabel(serviceSlug);
  if (deep) return deep;
  const carpet = getCarpetWizardSummaryFrequencyLabel(serviceSlug);
  if (carpet) return carpet;
  return isAirbnbCleaningSlug(serviceSlug) ? "Turnover cadence" : "Frequency";
}

export function getWizardSummaryAddonsLabel(serviceSlug: ServiceSlug | null): string {
  const office = getOfficeWizardSummaryAddonsLabel(serviceSlug);
  if (office) return office;
  const moving = getMovingWizardSummaryAddonsLabel(serviceSlug);
  if (moving) return moving;
  const deep = getDeepWizardSummaryAddonsLabel(serviceSlug);
  if (deep) return deep;
  const carpet = getCarpetWizardSummaryAddonsLabel(serviceSlug);
  if (carpet) return carpet;
  return isAirbnbCleaningSlug(serviceSlug) ? "Turnover extras" : "Add-ons";
}

export function getWizardSummaryLocationLabel(serviceSlug: ServiceSlug | null): string {
  const office = getOfficeWizardSummaryLocationLabel(serviceSlug);
  if (office) return office;
  const moving = getMovingWizardSummaryLocationLabel(serviceSlug);
  if (moving) return moving;
  const deep = getDeepWizardSummaryLocationLabel(serviceSlug);
  if (deep) return deep;
  const carpet = getCarpetWizardSummaryLocationLabel(serviceSlug);
  if (carpet) return carpet;
  return isAirbnbCleaningSlug(serviceSlug) ? "Property" : "Location";
}

export function getWizardSummaryEstimateHint(serviceSlug: ServiceSlug | null): string {
  const office = getOfficeWizardSummaryEstimateHint(serviceSlug);
  if (office) return office;
  const moving = getMovingWizardSummaryEstimateHint(serviceSlug);
  if (moving) return moving;
  const deep = getDeepWizardSummaryEstimateHint(serviceSlug);
  if (deep) return deep;
  const carpet = getCarpetWizardSummaryEstimateHint(serviceSlug);
  if (carpet) return carpet;
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return "Estimate only — confirmed total on review.";
  }
  return "Estimate only — confirmed on review.";
}

export function getWizardCleanerFootnote(serviceSlug: ServiceSlug | null): string | undefined {
  const office = getOfficeWizardCleanerFootnote(serviceSlug);
  if (office) return office;
  const moving = getMovingWizardCleanerFootnote(serviceSlug);
  if (moving) return moving;
  const deep = getDeepWizardCleanerFootnote(serviceSlug);
  if (deep) return deep;
  const carpet = getCarpetWizardCleanerFootnote(serviceSlug);
  if (carpet) return carpet;
  if (isAirbnbCleaningSlug(serviceSlug)) {
    return "Cleaner preference is saved with your turnover. Assignment finalizes after payment.";
  }
  return "Cleaner preference is saved with your booking. Assignment finalizes after payment.";
}

export { isCarpetCleaningSlug, isDeepCleaningSlug, isMovingCleaningSlug };

/** Customer dashboard status lines — presentation only. */
export function getReviewAddonsSectionLabel(serviceSlug: ServiceSlug | null): string {
  const officeReview = getOfficeCleaningReviewCopy(serviceSlug);
  if (officeReview) return officeReview.addonsSectionLabel;
  const movingReview = getMovingCleaningReviewCopy(serviceSlug);
  if (movingReview) return movingReview.addonsSectionLabel;
  const deepReview = getDeepCleaningReviewCopy(serviceSlug);
  if (deepReview) return deepReview.addonsSectionLabel;
  const carpetReview = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpetReview) return carpetReview.addonsSectionLabel;
  return isAirbnbCleaningSlug(serviceSlug) ? "Turnover extras" : "Add-ons";
}

/** Review row label for workspace sqm (office only). */
export function getReviewWorkspaceSizeRowLabel(serviceSlug: ServiceSlug | null): string {
  const officeReview = getOfficeCleaningReviewCopy(serviceSlug);
  if (officeReview) return officeReview.workspaceSizeRowLabel;
  return "Bathrooms";
}

export function customerAirbnbStatusLine(
  status: BookingStatus,
  defaultLine: string,
): string {
  switch (status) {
    case "pending_payment":
      return "Complete checkout to secure your turnover slot.";
    case "confirmed":
      return "Preparing cleaner assignment for your property.";
    case "pending_assignment":
      return "Finding a cleaner for your turnover schedule.";
    case "assigned":
      return "Your turnover cleaner is confirmed.";
    case "in_progress":
      return "Guest-ready preparation in progress.";
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Turnover complete — property prepared for guests.";
    default:
      return defaultLine;
  }
}

export function customerAirbnbTimingHint(
  status: BookingStatus,
  defaultHint: string | null,
): string | null {
  switch (status) {
    case "pending_payment":
      return "Before your next guest check-in";
    case "confirmed":
    case "pending_assignment":
      return "Usually within a few minutes";
    case "assigned":
      return "Before your scheduled turnover window";
    case "in_progress":
      return "During your turnover window";
    default:
      return defaultHint;
  }
}

/** Cleaner dashboard job hero — turnover-focused. */
export function cleanerAirbnbJobDescription(
  status: BookingStatus,
  defaultDescription: string,
): string {
  switch (status) {
    case "assigned":
      return "Turnover scheduled — review access and host instructions before arrival.";
    case "in_progress":
      return "Turnover in progress — finish guest-ready standards before marking complete.";
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Turnover complete. Payout status is below.";
    default:
      return defaultDescription;
  }
}

export function cleanerAirbnbExpectedUpdate(
  status: BookingStatus,
  defaultUpdate: string | null,
): string | null {
  switch (status) {
    case "assigned":
      return "Start on site — follow host access and turnover extras";
    case "in_progress":
      return "Mark complete when the property is guest-ready";
    default:
      return defaultUpdate;
  }
}

/** Future-ready checklist placeholders — display only, no enforcement. */
export const AIRBNB_CLEANER_CHECKLIST_PLACEHOLDERS = [
  "Linen completed",
  "Restock confirmed",
  "Guest-ready checklist",
] as const;

export type AdminAirbnbListBadge = {
  label: string;
  tone: "info" | "neutral" | "warning";
};

/** Non-invasive admin list badges for Airbnb turnovers. */
export function adminAirbnbOperationalBadges(input: {
  serviceLabel: string;
  scheduledStart?: string;
  frequency?: PricingFrequency | null;
}): AdminAirbnbListBadge[] {
  if (input.serviceLabel !== "Airbnb Cleaning") return [];

  const badges: AdminAirbnbListBadge[] = [{ label: "Turnover", tone: "info" }];

  if (input.scheduledStart && isSameCalendarDayTurnover(input.scheduledStart)) {
    badges.push({ label: "Same-day turnover", tone: "warning" });
  }

  if (input.frequency && input.frequency !== "once") {
    badges.push({ label: "Recurring host", tone: "neutral" });
  }

  return badges;
}

function isSameCalendarDayTurnover(scheduledStart: string): boolean {
  const start = new Date(scheduledStart);
  if (Number.isNaN(start.getTime())) return false;
  const now = new Date();
  return (
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate()
  );
}
