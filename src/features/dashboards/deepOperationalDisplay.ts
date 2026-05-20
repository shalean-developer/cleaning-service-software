/**
 * Deep Cleaning operational copy for cleaner and admin surfaces.
 * Presentation only — no dispatch, assignment, lifecycle, or earnings logic.
 */

import type { BookingStatus } from "@/features/bookings/server/types";
import {
  adminDeepOperationalBadges,
  DEEP_CLEANING_SLUG,
  isDeepCleaningSlug,
} from "@/features/booking-wizard/deepCleaningDisplay";
import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";

export { DEEP_CLEANING_SLUG, isDeepCleaningSlug };

const DEEP_SERVICE_LABEL = SERVICE_CATALOG[DEEP_CLEANING_SLUG].label;

export type DeepOperationalIdentity = {
  serviceSlug?: string | null;
  serviceLabel?: string | null;
};

export function isDeepOperationalBooking(input: DeepOperationalIdentity): boolean {
  if (isDeepCleaningSlug(input.serviceSlug)) return true;
  return input.serviceLabel?.trim() === DEEP_SERVICE_LABEL;
}

export function resolveDeepOperationalSlug(
  input: DeepOperationalIdentity,
): typeof DEEP_CLEANING_SLUG | null {
  return isDeepOperationalBooking(input) ? DEEP_CLEANING_SLUG : null;
}

export type DeepCleanerOfferCopy = {
  serviceEyebrow: string;
  offerSubtitle: string;
  schedulePrefix: string | null;
  accessHint: string;
  standardHint: string;
};

export function getDeepCleanerOfferCopy(): DeepCleanerOfferCopy {
  return {
    serviceEyebrow: "Deep cleaning offer",
    offerSubtitle: "Intensive restoration · detailed surface attention",
    schedulePrefix: "Deep clean window",
    accessHint: "Attention areas included",
    standardHint: "Restoration-focused standard",
  };
}

export type DeepCleanerJobCopy = {
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

export function getDeepCleanerJobCopy(): DeepCleanerJobCopy {
  return {
    shellSubtitle: "Deep clean schedule, access, pay, and restoration steps.",
    detailsSectionTitle: "Deep-clean priorities",
    activitySectionTitle: "Activity",
    addressLabel: "Home",
    homeSizeLabel: "Home size",
    notesSectionTitle: "Attention areas",
    notesIntro: "Access, buildup priorities, and detailed extras from the customer.",
    heroSubtitle: "Detailed restoration cleaning",
    completedDescription: "Home restoration cleaning complete.",
  };
}

export type DeepCleanerJobGuidanceStep = {
  title: string;
  body: string;
};

export function getDeepCleanerJobGuidanceSteps(
  status: BookingStatus,
): readonly DeepCleanerJobGuidanceStep[] | null {
  switch (status) {
    case "assigned":
      return [
        {
          title: "Review attention areas",
          body: "Check customer notes for buildup, problem areas, and priority rooms.",
        },
        {
          title: "Prioritize detailed extras",
          body: "Focus on inside cabinets, oven, fridge, and other selected restoration extras.",
        },
        {
          title: "Buildup and high-use surfaces",
          body: "Restore kitchens, baths, and high-traffic areas before marking complete.",
        },
        {
          title: "Confirm add-on completion",
          body: "Verify each selected detailed extra is finished within your scheduled window.",
        },
      ];
    case "in_progress":
      return [
        {
          title: "Restoration-focused finish",
          body: "Detail clean suitable for seasonal reset and neglected-space recovery.",
        },
        {
          title: "Mark complete",
          body: "Tap Mark complete when restoration-focused cleaning is finished.",
        },
      ];
    case "completed":
    case "payout_ready":
    case "paid_out":
      return [
        { title: "Deep clean recorded", body: "Logged as complete in your history." },
        { title: "Payout", body: "Pay status updates below — unchanged from other services." },
      ];
    default:
      return null;
  }
}

export function cleanerDeepJobStatusLabel(status: BookingStatus): string | null {
  switch (status) {
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Deep clean completed";
    default:
      return null;
  }
}

export type DeepAdminBookingListCopy = {
  serviceSubtitle: string;
  listCtaLabel: string;
};

export function getDeepAdminBookingListCopy(): DeepAdminBookingListCopy {
  return {
    serviceSubtitle: "Deep clean · detailed restoration",
    listCtaLabel: "Open deep clean",
  };
}

export type AdminDeepListBadge = {
  label: string;
  tone: "info" | "neutral" | "warning";
};

export function getDeepAdminListBadges(input: {
  serviceLabel: string;
  scheduledStart?: string;
}): AdminDeepListBadge[] {
  return adminDeepOperationalBadges({
    serviceLabel: input.serviceLabel,
    scheduledStart: input.scheduledStart,
  });
}

export function adminDeepBookingListNextAction(
  defaultAction: string | null,
  input: DeepOperationalIdentity & { status: BookingStatus },
): string | null {
  if (!isDeepOperationalBooking(input)) return defaultAction;
  if (!defaultAction) return null;

  if (input.status === "payment_failed") {
    return "Customer must complete payment before deep clean assignment.";
  }
  if (defaultAction.includes("Send offer") || defaultAction.includes("assign cleaner")) {
    return "Assign deep cleaning cleaner on booking detail when eligible.";
  }
  if (defaultAction.includes("Redispatch")) {
    return "Redispatch — offer an eligible deep cleaning cleaner.";
  }
  if (defaultAction.includes("Recover assignment") || defaultAction.includes("Recover")) {
    return "Recover deep clean assignment on booking detail when eligible.";
  }
  if (defaultAction.includes("dispatch")) {
    return "Deep clean dispatch — open booking detail to send offer or recover.";
  }
  if (defaultAction.includes("payout")) {
    return defaultAction;
  }
  if (defaultAction.includes("triage")) {
    return "Deep clean assignment needs triage — open booking detail.";
  }
  return defaultAction;
}

export type DeepAdminBookingDetailCopy = {
  shellSubtitle: string;
  heroHeadline: string;
  contextSectionTitle: string;
  homeSizeLabel: string;
  paymentFailedNote: string;
  lifecycleDescription: string;
  assignmentSectionTitle: string;
};

export function getDeepAdminBookingDetailCopy(): DeepAdminBookingDetailCopy {
  return {
    shellSubtitle: "Deep Cleaning — ops, payment, and restoration context",
    heroHeadline: "Detailed restoration",
    contextSectionTitle: "Deep-clean priorities",
    homeSizeLabel: "Home size",
    paymentFailedNote:
      "Customer payment did not complete. No deep clean assignment or earnings until payment succeeds.",
    lifecycleDescription:
      "Customer-visible deep cleaning progress from payment through completion.",
    assignmentSectionTitle: "Deep cleaning cleaner offers",
  };
}

export function mapAdminBookingHeroRowsForDeep<
  T extends { label: string; value: string; valueClassName?: string },
>(rows: T[], options?: { notesLabel?: string }): T[] {
  const labelMap: Record<string, string> = {
    "Home size": "Home size",
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

export type DeepOperationsQueueCopy = {
  cardSubtitle: string;
  attentionFlagLabel: string | null;
  openBookingCta: string;
  sameDayNote: string | null;
};

export function getDeepOperationsQueueCopy(input: {
  serviceLabel: string;
  scheduleLabel: string;
  scheduledStart?: string;
}): DeepOperationsQueueCopy | null {
  if (!isDeepOperationalBooking({ serviceLabel: input.serviceLabel })) return null;

  const badges = adminDeepOperationalBadges({
    serviceLabel: input.serviceLabel,
    scheduledStart: input.scheduledStart,
  });
  const scheduledToday = badges.some((b) => b.label === "Scheduled today");

  return {
    cardSubtitle: "Deep clean · intensive restoration",
    attentionFlagLabel: scheduledToday ? "Scheduled today" : "Deep clean",
    openBookingCta: "Open deep clean booking →",
    sameDayNote: scheduledToday ? "Scheduled today — prioritize assignment." : null,
  };
}

export type DeepAdminCustomerBookingCardCopy = {
  serviceSubtitle: string;
  unassignedLabel: string;
};

export function getDeepAdminCustomerBookingCardCopy(): DeepAdminCustomerBookingCardCopy {
  return {
    serviceSubtitle: "Deep cleaning · detailed restoration",
    unassignedLabel: "No deep cleaning cleaner assigned yet",
  };
}
