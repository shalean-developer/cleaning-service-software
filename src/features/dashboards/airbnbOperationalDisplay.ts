/**
 * Airbnb Cleaning operational copy for cleaner and admin surfaces.
 * Presentation only. no dispatch, assignment, lifecycle, or earnings logic.
 */

import type { BookingStatus } from "@/features/bookings/server/types";
import {
  adminAirbnbOperationalBadges,
  AIRBNB_CLEANING_SLUG,
  isAirbnbCleaningSlug,
} from "@/features/booking-wizard/airbnbCleaningDisplay";
import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";

export { AIRBNB_CLEANING_SLUG, isAirbnbCleaningSlug };

const AIRBNB_SERVICE_LABEL = SERVICE_CATALOG[AIRBNB_CLEANING_SLUG].label;

export type AirbnbOperationalIdentity = {
  serviceSlug?: string | null;
  serviceLabel?: string | null;
};

/** Resolves Airbnb from slug or catalog service label (no DB lookup). */
export function isAirbnbOperationalBooking(input: AirbnbOperationalIdentity): boolean {
  if (isAirbnbCleaningSlug(input.serviceSlug)) return true;
  return input.serviceLabel?.trim() === AIRBNB_SERVICE_LABEL;
}

export function resolveAirbnbOperationalSlug(
  input: AirbnbOperationalIdentity,
): typeof AIRBNB_CLEANING_SLUG | null {
  return isAirbnbOperationalBooking(input) ? AIRBNB_CLEANING_SLUG : null;
}

export type AirbnbCleanerOfferCopy = {
  serviceEyebrow: string;
  offerSubtitle: string;
  schedulePrefix: string | null;
  accessHint: string;
  standardHint: string;
};

export function getAirbnbCleanerOfferCopy(): AirbnbCleanerOfferCopy {
  return {
    serviceEyebrow: "Turnover cleaning offer",
    offerSubtitle: "Prepare property for guest arrival",
    schedulePrefix: "Turnover window",
    accessHint: "Host instructions included",
    standardHint: "Guest-ready standard",
  };
}

export type AirbnbCleanerJobCopy = {
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

export function getAirbnbCleanerJobCopy(): AirbnbCleanerJobCopy {
  return {
    shellSubtitle: "Turnover schedule, property access, pay, and next steps.",
    detailsSectionTitle: "Turnover details",
    activitySectionTitle: "Activity",
    addressLabel: "Property",
    homeSizeLabel: "Property size",
    notesSectionTitle: "Host instructions",
    notesIntro: "Property access and turnover priorities from the host.",
    heroSubtitle: "Guest-ready turnover",
    completedDescription: "Property prepared for guest arrival.",
  };
}

export type AirbnbCleanerJobGuidanceStep = {
  title: string;
  body: string;
};

/** Optional compact turnover guidance. display only, not enforced. */
export function getAirbnbCleanerJobGuidanceSteps(
  status: BookingStatus,
): readonly AirbnbCleanerJobGuidanceStep[] | null {
  switch (status) {
    case "assigned":
      return [
        { title: "Confirm property size", body: "Match bedrooms, baths, and turnover extras." },
        { title: "Follow host instructions", body: "Access, linen, and restocking notes apply." },
        { title: "Guest-ready areas", body: "Prioritize kitchen, baths, and arrival surfaces." },
        { title: "Prepare before guest arrival", body: "Finish within your scheduled turnover window." },
      ];
    case "in_progress":
      return [
        { title: "Guest-ready standard", body: "Leave the property ready for the next guest." },
        { title: "Mark complete", body: "Tap Mark complete when turnover work is finished." },
      ];
    case "completed":
    case "payout_ready":
    case "paid_out":
      return [
        { title: "Turnover completed", body: "Guest-ready preparation complete." },
        { title: "Payout", body: "Pay status updates below. unchanged from other services." },
      ];
    default:
      return null;
  }
}

/** Overrides cleaner job status badge label for completed turnovers. */
export function cleanerAirbnbJobStatusLabel(status: BookingStatus): string | null {
  switch (status) {
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Turnover completed";
    default:
      return null;
  }
}

export type AirbnbAdminBookingListCopy = {
  serviceSubtitle: string;
  listCtaLabel: string;
};

export function getAirbnbAdminBookingListCopy(): AirbnbAdminBookingListCopy {
  return {
    serviceSubtitle: "Airbnb turnover",
    listCtaLabel: "Open turnover",
  };
}

export type AdminAirbnbListBadge = {
  label: string;
  tone: "info" | "neutral" | "warning";
};

export function getAirbnbAdminListBadges(input: {
  serviceLabel: string;
  scheduledStart?: string;
}): AdminAirbnbListBadge[] {
  return adminAirbnbOperationalBadges({
    serviceLabel: input.serviceLabel,
    scheduledStart: input.scheduledStart,
  });
}

/** Airbnb-specific admin list next-action phrasing (presentation only). */
export function adminAirbnbBookingListNextAction(
  defaultAction: string | null,
  input: AirbnbOperationalIdentity & { status: BookingStatus },
): string | null {
  if (!isAirbnbOperationalBooking(input)) return defaultAction;
  if (!defaultAction) return null;

  if (input.status === "payment_failed") {
    return "Host must complete payment before turnover assignment.";
  }
  if (defaultAction.includes("Send offer") || defaultAction.includes("assign cleaner")) {
    return "Assign turnover cleaner on booking detail when eligible.";
  }
  if (defaultAction.includes("Redispatch")) {
    return "Redispatch. offer an eligible turnover cleaner.";
  }
  if (defaultAction.includes("Recover assignment") || defaultAction.includes("Recover")) {
    return "Recover turnover assignment on booking detail when eligible.";
  }
  if (defaultAction.includes("dispatch")) {
    return "Turnover dispatch. open booking detail to send offer or recover.";
  }
  if (defaultAction.includes("payout")) {
    return defaultAction;
  }
  if (defaultAction.includes("triage")) {
    return "Turnover assignment needs triage. open booking detail.";
  }
  return defaultAction;
}

export type AirbnbAdminBookingDetailCopy = {
  shellSubtitle: string;
  heroHeadline: string;
  contextSectionTitle: string;
  homeSizeLabel: string;
  paymentFailedNote: string;
  lifecycleDescription: string;
  assignmentSectionTitle: string;
};

export function getAirbnbAdminBookingDetailCopy(): AirbnbAdminBookingDetailCopy {
  return {
    shellSubtitle: "Airbnb turnover. ops, payment, and property context",
    heroHeadline: "Airbnb turnover",
    contextSectionTitle: "Turnover context",
    homeSizeLabel: "Property size",
    paymentFailedNote:
      "Host payment did not complete. No turnover assignment or earnings until payment succeeds.",
    lifecycleDescription: "Host-visible turnover progress from payment through completion.",
    assignmentSectionTitle: "Turnover cleaner offers",
  };
}

/** Relabels admin hero context rows for Airbnb without changing values. */
export function mapAdminBookingHeroRowsForAirbnb<
  T extends { label: string; value: string; valueClassName?: string },
>(rows: T[], options?: { notesLabel?: string }): T[] {
  const labelMap: Record<string, string> = {
    "Home size": "Property size",
    "Cleaning supplies": "Supplies & equipment",
    "Customer phone": "Host phone",
  };
  if (options?.notesLabel) {
    labelMap.Notes = options.notesLabel;
  }
  return rows.map((row) => ({
    ...row,
    label: labelMap[row.label] ?? row.label,
  }));
}

export type AirbnbOperationsQueueCopy = {
  cardSubtitle: string;
  attentionFlagLabel: string | null;
  openBookingCta: string;
  sameDayNote: string | null;
};

export function getAirbnbOperationsQueueCopy(input: {
  serviceLabel: string;
  scheduleLabel: string;
  scheduledStart?: string;
}): AirbnbOperationsQueueCopy | null {
  if (!isAirbnbOperationalBooking({ serviceLabel: input.serviceLabel })) return null;

  const badges = adminAirbnbOperationalBadges({
    serviceLabel: input.serviceLabel,
    scheduledStart: input.scheduledStart,
  });
  const sameDay = badges.some((b) => b.label === "Same-day turnover");

  return {
    cardSubtitle: "Guest-ready turnover · host property",
    attentionFlagLabel: sameDay ? "Same-day turnover" : "Turnover",
    openBookingCta: "Open turnover booking →",
    sameDayNote: sameDay ? "Same-day turnover. prioritize assignment." : null,
  };
}

export type AirbnbAdminCustomerBookingCardCopy = {
  serviceSubtitle: string;
  unassignedLabel: string;
};

export function getAirbnbAdminCustomerBookingCardCopy(): AirbnbAdminCustomerBookingCardCopy {
  return {
    serviceSubtitle: "Airbnb turnover",
    unassignedLabel: "No turnover cleaner assigned yet",
  };
}
