/**
 * Move In/Out Cleaning operational copy for cleaner and admin surfaces.
 * Presentation only — no dispatch, assignment, lifecycle, or earnings logic.
 */

import type { BookingStatus } from "@/features/bookings/server/types";
import {
  adminMovingOperationalBadges,
  MOVING_CLEANING_SLUG,
  isMovingCleaningSlug,
} from "@/features/booking-wizard/movingCleaningDisplay";
import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";

export { MOVING_CLEANING_SLUG, isMovingCleaningSlug };

const MOVING_SERVICE_LABEL = SERVICE_CATALOG[MOVING_CLEANING_SLUG].label;

export type MovingOperationalIdentity = {
  serviceSlug?: string | null;
  serviceLabel?: string | null;
};

export function isMovingOperationalBooking(input: MovingOperationalIdentity): boolean {
  if (isMovingCleaningSlug(input.serviceSlug)) return true;
  return input.serviceLabel?.trim() === MOVING_SERVICE_LABEL;
}

export function resolveMovingOperationalSlug(
  input: MovingOperationalIdentity,
): typeof MOVING_CLEANING_SLUG | null {
  return isMovingOperationalBooking(input) ? MOVING_CLEANING_SLUG : null;
}

export type MovingCleanerOfferCopy = {
  serviceEyebrow: string;
  offerSubtitle: string;
  schedulePrefix: string | null;
  accessHint: string;
  standardHint: string;
};

export function getMovingCleanerOfferCopy(): MovingCleanerOfferCopy {
  return {
    serviceEyebrow: "Move preparation offer",
    offerSubtitle: "Vacant property · inspection-ready clean",
    schedulePrefix: "Move window",
    accessHint: "Move instructions included",
    standardHint: "Handover-ready standard",
  };
}

export type MovingCleanerJobCopy = {
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

export function getMovingCleanerJobCopy(): MovingCleanerJobCopy {
  return {
    shellSubtitle: "Move schedule, property access, pay, and preparation steps.",
    detailsSectionTitle: "Move preparation details",
    activitySectionTitle: "Activity",
    addressLabel: "Property",
    homeSizeLabel: "Property size",
    notesSectionTitle: "Move instructions",
    notesIntro: "Access, handover timing, and inspection priorities from the customer.",
    heroSubtitle: "Move In/Out preparation",
    completedDescription: "Property prepared for handover or occupancy.",
  };
}

export type MovingCleanerJobGuidanceStep = {
  title: string;
  body: string;
};

export function getMovingCleanerJobGuidanceSteps(
  status: BookingStatus,
): readonly MovingCleanerJobGuidanceStep[] | null {
  switch (status) {
    case "assigned":
      return [
        {
          title: "Confirm property access",
          body: "Vacant access, keys, and estate or building entry before you start.",
        },
        {
          title: "Inspection-focused areas",
          body: "Prioritize kitchens, baths, appliances, and selected inspection extras.",
        },
        {
          title: "Empty property check",
          body: "Confirm all rooms are accessible — note anything blocked on site.",
        },
        {
          title: "Handover-ready finish",
          body: "Complete within your scheduled window before keys or inspection.",
        },
      ];
    case "in_progress":
      return [
        {
          title: "Inspection-ready standard",
          body: "Detail clean suitable for handover or move-in.",
        },
        {
          title: "Mark complete",
          body: "Tap Mark complete when the property is handover-ready.",
        },
      ];
    case "completed":
    case "payout_ready":
    case "paid_out":
      return [
        { title: "Move clean recorded", body: "Logged as complete in your history." },
        { title: "Payout", body: "Pay status updates below — unchanged from other services." },
      ];
    default:
      return null;
  }
}

export function cleanerMovingJobStatusLabel(status: BookingStatus): string | null {
  switch (status) {
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Move clean completed";
    default:
      return null;
  }
}

export type MovingAdminBookingListCopy = {
  serviceSubtitle: string;
  listCtaLabel: string;
};

export function getMovingAdminBookingListCopy(): MovingAdminBookingListCopy {
  return {
    serviceSubtitle: "Move In/Out · handover prep",
    listCtaLabel: "Open move clean",
  };
}

export type AdminMovingListBadge = {
  label: string;
  tone: "info" | "neutral" | "warning";
};

export function getMovingAdminListBadges(input: {
  serviceLabel: string;
  scheduledStart?: string;
}): AdminMovingListBadge[] {
  return adminMovingOperationalBadges({
    serviceLabel: input.serviceLabel,
    scheduledStart: input.scheduledStart,
  });
}

export function adminMovingBookingListNextAction(
  defaultAction: string | null,
  input: MovingOperationalIdentity & { status: BookingStatus },
): string | null {
  if (!isMovingOperationalBooking(input)) return defaultAction;
  if (!defaultAction) return null;

  if (input.status === "payment_failed") {
    return "Customer must complete payment before move clean assignment.";
  }
  if (defaultAction.includes("Send offer") || defaultAction.includes("assign cleaner")) {
    return "Assign move preparation cleaner on booking detail when eligible.";
  }
  if (defaultAction.includes("Redispatch")) {
    return "Redispatch — offer an eligible move preparation cleaner.";
  }
  if (defaultAction.includes("Recover assignment") || defaultAction.includes("Recover")) {
    return "Recover move clean assignment on booking detail when eligible.";
  }
  if (defaultAction.includes("dispatch")) {
    return "Move clean dispatch — open booking detail to send offer or recover.";
  }
  if (defaultAction.includes("payout")) {
    return defaultAction;
  }
  if (defaultAction.includes("triage")) {
    return "Move clean assignment needs triage — open booking detail.";
  }
  return defaultAction;
}

export type MovingAdminBookingDetailCopy = {
  shellSubtitle: string;
  heroHeadline: string;
  contextSectionTitle: string;
  homeSizeLabel: string;
  paymentFailedNote: string;
  lifecycleDescription: string;
  assignmentSectionTitle: string;
};

export function getMovingAdminBookingDetailCopy(): MovingAdminBookingDetailCopy {
  return {
    shellSubtitle: "Move In/Out — ops, payment, and handover context",
    heroHeadline: "Move preparation",
    contextSectionTitle: "Move preparation context",
    homeSizeLabel: "Property size",
    paymentFailedNote:
      "Customer payment did not complete. No move clean assignment or earnings until payment succeeds.",
    lifecycleDescription:
      "Customer-visible move preparation progress from payment through completion.",
    assignmentSectionTitle: "Move preparation cleaner offers",
  };
}

export function mapAdminBookingHeroRowsForMoving<
  T extends { label: string; value: string; valueClassName?: string },
>(rows: T[], options?: { notesLabel?: string }): T[] {
  const labelMap: Record<string, string> = {
    "Home size": "Property size",
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

export type MovingOperationsQueueCopy = {
  cardSubtitle: string;
  attentionFlagLabel: string | null;
  openBookingCta: string;
  /** Same shape as Airbnb queue copy for shared UI. */
  sameDayNote: string | null;
};

export function getMovingOperationsQueueCopy(input: {
  serviceLabel: string;
  scheduleLabel: string;
  scheduledStart?: string;
}): MovingOperationsQueueCopy | null {
  if (!isMovingOperationalBooking({ serviceLabel: input.serviceLabel })) return null;

  const badges = adminMovingOperationalBadges({
    serviceLabel: input.serviceLabel,
    scheduledStart: input.scheduledStart,
  });
  const handoverDay = badges.some((b) => b.label === "Handover day");

  return {
    cardSubtitle: "Move In/Out · vacant / handover property",
    attentionFlagLabel: handoverDay ? "Handover day" : "Move clean",
    openBookingCta: "Open move clean booking →",
    sameDayNote: handoverDay ? "Handover day — prioritize assignment." : null,
  };
}

export type MovingAdminCustomerBookingCardCopy = {
  serviceSubtitle: string;
  unassignedLabel: string;
};

export function getMovingAdminCustomerBookingCardCopy(): MovingAdminCustomerBookingCardCopy {
  return {
    serviceSubtitle: "Move In/Out preparation",
    unassignedLabel: "No move preparation cleaner assigned yet",
  };
}
