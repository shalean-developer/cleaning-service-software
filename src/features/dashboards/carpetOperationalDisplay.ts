/**
 * Carpet Cleaning operational copy for cleaner and admin surfaces.
 * Presentation only. no dispatch, assignment, lifecycle, or earnings logic.
 */

import type { BookingStatus } from "@/features/bookings/server/types";
import {
  adminCarpetOperationalBadges,
  CARPET_CLEANING_SLUG,
  isCarpetCleaningSlug,
} from "@/features/booking-wizard/carpetCleaningDisplay";
import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";

export { CARPET_CLEANING_SLUG, isCarpetCleaningSlug };

const CARPET_SERVICE_LABEL = SERVICE_CATALOG[CARPET_CLEANING_SLUG].label;

export type CarpetOperationalIdentity = {
  serviceSlug?: string | null;
  serviceLabel?: string | null;
};

export function isCarpetOperationalBooking(input: CarpetOperationalIdentity): boolean {
  if (isCarpetCleaningSlug(input.serviceSlug)) return true;
  return input.serviceLabel?.trim() === CARPET_SERVICE_LABEL;
}

export function resolveCarpetOperationalSlug(
  input: CarpetOperationalIdentity,
): typeof CARPET_CLEANING_SLUG | null {
  return isCarpetOperationalBooking(input) ? CARPET_CLEANING_SLUG : null;
}

export type CarpetCleanerOfferCopy = {
  serviceEyebrow: string;
  offerSubtitle: string;
  schedulePrefix: string | null;
  accessHint: string;
  standardHint: string;
};

export function getCarpetCleanerOfferCopy(): CarpetCleanerOfferCopy {
  return {
    serviceEyebrow: "Carpet cleaning offer",
    offerSubtitle: "Floor-care · stain-focused refresh",
    schedulePrefix: "Carpet window",
    accessHint: "Stain & access notes included",
    standardHint: "Fabric-safe floor-care standard",
  };
}

export type CarpetCleanerJobCopy = {
  shellSubtitle: string;
  detailsSectionTitle: string;
  activitySectionTitle: string;
  addressLabel: string;
  homeSizeLabel: string;
  notesSectionTitle: string;
  notesIntro: string;
  heroSubtitle: string;
  completedDescription: string;
};

export function getCarpetCleanerJobCopy(): CarpetCleanerJobCopy {
  return {
    shellSubtitle: "Carpet schedule, zones, pay, and floor-care steps.",
    detailsSectionTitle: "Carpet cleaning details",
    activitySectionTitle: "Activity",
    addressLabel: "Property",
    homeSizeLabel: "Carpet zones",
    notesSectionTitle: "Areas needing attention",
    notesIntro: "Stain locations, high-traffic paths, and access notes from the customer.",
    heroSubtitle: "Carpet & floor-care",
    completedDescription: "Carpet zones refreshed. allow drying time on site.",
  };
}

export type CarpetCleanerJobGuidanceStep = {
  title: string;
  body: string;
};

export function getCarpetCleanerJobGuidanceSteps(
  status: BookingStatus,
): readonly CarpetCleanerJobGuidanceStep[] | null {
  switch (status) {
    case "assigned":
      return [
        {
          title: "Review stain notes",
          body: "Check customer notes for stain locations and delicate fabrics before starting.",
        },
        {
          title: "High-traffic areas first",
          body: "Prioritize lounges, halls, and paths. then remaining carpet zones.",
        },
        {
          title: "Ventilation after cleaning",
          body: "Allow airflow in carpeted rooms. mention drying time to the customer if on site.",
        },
      ];
    case "in_progress":
      return [
        {
          title: "Fabric-safe products",
          body: "Protect delicate flooring and fabrics near carpet edges.",
        },
        {
          title: "Mark complete",
          body: "Tap Mark complete when all booked zones are refreshed.",
        },
      ];
    case "completed":
    case "payout_ready":
    case "paid_out":
      return [
        { title: "Carpet clean recorded", body: "Logged as complete in your history." },
        { title: "Payout", body: "Pay status updates below. unchanged from other services." },
      ];
    default:
      return null;
  }
}

export function cleanerCarpetJobStatusLabel(status: BookingStatus): string | null {
  switch (status) {
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Carpet refresh completed";
    default:
      return null;
  }
}

export type CarpetAdminBookingListCopy = {
  serviceSubtitle: string;
  listCtaLabel: string;
};

export function getCarpetAdminBookingListCopy(): CarpetAdminBookingListCopy {
  return {
    serviceSubtitle: "Carpet · floor-care / stain treatment",
    listCtaLabel: "Open carpet clean",
  };
}

export type AdminCarpetListBadge = {
  label: string;
  tone: "info" | "neutral" | "warning";
};

export function getCarpetAdminListBadges(input: {
  serviceLabel: string;
  scheduledStart?: string;
}): AdminCarpetListBadge[] {
  return adminCarpetOperationalBadges({
    serviceLabel: input.serviceLabel,
  });
}

export function adminCarpetBookingListNextAction(
  defaultAction: string | null,
  input: CarpetOperationalIdentity & { status: BookingStatus },
): string | null {
  if (!isCarpetOperationalBooking(input)) return defaultAction;
  if (!defaultAction) return null;

  if (input.status === "payment_failed") {
    return "Customer must complete payment before carpet cleaning assignment.";
  }
  if (defaultAction.includes("Send offer") || defaultAction.includes("assign cleaner")) {
    return "Assign carpet cleaning cleaner on booking detail when eligible.";
  }
  if (defaultAction.includes("Redispatch")) {
    return "Redispatch. offer an eligible carpet / floor-care cleaner.";
  }
  if (defaultAction.includes("Recover assignment") || defaultAction.includes("Recover")) {
    return "Recover carpet cleaning assignment on booking detail when eligible.";
  }
  if (defaultAction.includes("dispatch")) {
    return "Carpet clean dispatch. open booking detail to send offer or recover.";
  }
  if (defaultAction.includes("payout")) {
    return defaultAction;
  }
  if (defaultAction.includes("triage")) {
    return "Carpet cleaning assignment needs triage. open booking detail.";
  }
  return defaultAction;
}

export type CarpetAdminBookingDetailCopy = {
  shellSubtitle: string;
  heroHeadline: string;
  contextSectionTitle: string;
  homeSizeLabel: string;
  paymentFailedNote: string;
  lifecycleDescription: string;
  assignmentSectionTitle: string;
};

export function getCarpetAdminBookingDetailCopy(): CarpetAdminBookingDetailCopy {
  return {
    shellSubtitle: "Carpet Cleaning. ops, payment, and floor-care context",
    heroHeadline: "Floor-care service",
    contextSectionTitle: "Carpet cleaning context",
    homeSizeLabel: "Carpet zones",
    paymentFailedNote:
      "Customer payment did not complete. No carpet cleaning assignment or earnings until payment succeeds.",
    lifecycleDescription:
      "Customer-visible carpet cleaning progress from payment through completion.",
    assignmentSectionTitle: "Carpet cleaning cleaner offers",
  };
}

export function mapAdminBookingHeroRowsForCarpet<
  T extends { label: string; value: string; valueClassName?: string },
>(rows: T[], options?: { notesLabel?: string }): T[] {
  const labelMap: Record<string, string> = {
    "Home size": "Carpet zones",
    Bedrooms: "Carpet zones",
    Bathrooms: "Carpet zones",
    "Customer phone": "Customer phone",
  };
  if (options?.notesLabel) {
    labelMap.Notes = options.notesLabel;
  }
  return rows.map((row) => ({
    ...row,
    label: labelMap[row.label] ?? row.label,
  }));
}

export type CarpetOperationsQueueCopy = {
  cardSubtitle: string;
  attentionFlagLabel: string | null;
  openBookingCta: string;
  sameDayNote: string | null;
};

export function getCarpetOperationsQueueCopy(input: {
  serviceLabel: string;
  scheduleLabel: string;
}): CarpetOperationsQueueCopy | null {
  if (!isCarpetOperationalBooking({ serviceLabel: input.serviceLabel })) return null;

  return {
    cardSubtitle: "Carpet · stain treatment / high-traffic refresh",
    attentionFlagLabel: "Floor-care",
    openBookingCta: "Open carpet cleaning booking →",
    sameDayNote: null,
  };
}

export type CarpetAdminCustomerBookingCardCopy = {
  serviceSubtitle: string;
  unassignedLabel: string;
};

export function getCarpetAdminCustomerBookingCardCopy(): CarpetAdminCustomerBookingCardCopy {
  return {
    serviceSubtitle: "Carpet floor-care",
    unassignedLabel: "No carpet cleaning cleaner assigned yet",
  };
}
