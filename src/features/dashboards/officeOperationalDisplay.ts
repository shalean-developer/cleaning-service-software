/**
 * Office Cleaning operational copy for cleaner and admin surfaces.
 * Presentation only — no dispatch, assignment, lifecycle, or earnings logic.
 */

import type { BookingStatus } from "@/features/bookings/server/types";
import {
  adminOfficeOperationalBadges,
  OFFICE_CLEANING_SLUG,
  isOfficeCleaningSlug,
} from "@/features/booking-wizard/officeCleaningDisplay";
import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";

export { OFFICE_CLEANING_SLUG, isOfficeCleaningSlug };

const OFFICE_SERVICE_LABEL = SERVICE_CATALOG[OFFICE_CLEANING_SLUG].label;

export type OfficeOperationalIdentity = {
  serviceSlug?: string | null;
  serviceLabel?: string | null;
};

export function isOfficeOperationalBooking(input: OfficeOperationalIdentity): boolean {
  if (isOfficeCleaningSlug(input.serviceSlug)) return true;
  return input.serviceLabel?.trim() === OFFICE_SERVICE_LABEL;
}

export function resolveOfficeOperationalSlug(
  input: OfficeOperationalIdentity,
): typeof OFFICE_CLEANING_SLUG | null {
  return isOfficeOperationalBooking(input) ? OFFICE_CLEANING_SLUG : null;
}

export type OfficeCleanerOfferCopy = {
  serviceEyebrow: string;
  offerSubtitle: string;
  schedulePrefix: string | null;
  accessHint: string;
  standardHint: string;
};

export function getOfficeCleanerOfferCopy(): OfficeCleanerOfferCopy {
  return {
    serviceEyebrow: "Office cleaning offer",
    offerSubtitle: "Commercial workspace · professional maintenance",
    schedulePrefix: "Service window",
    accessHint: "Workspace instructions included",
    standardHint: "Professional workspace standard",
  };
}

export type OfficeCleanerJobCopy = {
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

export function getOfficeCleanerJobCopy(): OfficeCleanerJobCopy {
  return {
    shellSubtitle: "Office schedule, business access, pay, and workspace steps.",
    detailsSectionTitle: "Workspace cleaning details",
    activitySectionTitle: "Activity",
    addressLabel: "Workspace",
    homeSizeLabel: "Workspace size",
    notesSectionTitle: "Workspace instructions",
    notesIntro: "Business access, after-hours coordination, and workspace priorities from the customer.",
    heroSubtitle: "Office & workspace cleaning",
    completedDescription: "Workspace maintained to professional standards.",
  };
}

export type OfficeCleanerJobGuidanceStep = {
  title: string;
  body: string;
};

export function getOfficeCleanerJobGuidanceSteps(
  status: BookingStatus,
): readonly OfficeCleanerJobGuidanceStep[] | null {
  switch (status) {
    case "assigned":
      return [
        {
          title: "Confirm office access",
          body: "Reception, security, floor or suite, parking, and after-hours entry before you start.",
        },
        {
          title: "Shared and common areas",
          body: "Prioritize reception, kitchens, meeting rooms, and high-traffic zones.",
        },
        {
          title: "Active work areas",
          body: "Coordinate around desks and teams — follow workspace instructions on site.",
        },
        {
          title: "Professional finish",
          body: "Complete within your scheduled window and follow business access instructions.",
        },
      ];
    case "in_progress":
      return [
        {
          title: "Workspace standards",
          body: "Maintain professional, productivity-safe cleaning in commercial areas.",
        },
        {
          title: "Mark complete",
          body: "Tap Mark complete when the workspace meets professional standards.",
        },
      ];
    case "completed":
    case "payout_ready":
    case "paid_out":
      return [
        { title: "Office clean recorded", body: "Logged as complete in your history." },
        { title: "Payout", body: "Pay status updates below — unchanged from other services." },
      ];
    default:
      return null;
  }
}

export function cleanerOfficeJobStatusLabel(status: BookingStatus): string | null {
  switch (status) {
    case "completed":
    case "payout_ready":
    case "paid_out":
      return "Office clean completed";
    default:
      return null;
  }
}

export type OfficeAdminBookingListCopy = {
  serviceSubtitle: string;
  listCtaLabel: string;
};

export function getOfficeAdminBookingListCopy(): OfficeAdminBookingListCopy {
  return {
    serviceSubtitle: "Office · commercial maintenance",
    listCtaLabel: "Open office clean",
  };
}

export type AdminOfficeListBadge = {
  label: string;
  tone: "info" | "neutral" | "warning";
};

export function getOfficeAdminListBadges(input: {
  serviceLabel: string;
  scheduledStart?: string;
  frequency?: import("@/features/pricing/server/types").PricingFrequency | null;
}): AdminOfficeListBadge[] {
  return adminOfficeOperationalBadges({
    serviceLabel: input.serviceLabel,
    scheduledStart: input.scheduledStart,
    frequency: input.frequency,
  });
}

export function adminOfficeBookingListNextAction(
  defaultAction: string | null,
  input: OfficeOperationalIdentity & { status: BookingStatus },
): string | null {
  if (!isOfficeOperationalBooking(input)) return defaultAction;
  if (!defaultAction) return null;

  if (input.status === "payment_failed") {
    return "Customer must complete payment before office clean assignment.";
  }
  if (defaultAction.includes("Send offer") || defaultAction.includes("assign cleaner")) {
    return "Assign office cleaning professional on booking detail when eligible.";
  }
  if (defaultAction.includes("Redispatch")) {
    return "Redispatch — offer an eligible office cleaning professional.";
  }
  if (defaultAction.includes("Recover assignment") || defaultAction.includes("Recover")) {
    return "Recover office clean assignment on booking detail when eligible.";
  }
  if (defaultAction.includes("dispatch")) {
    return "Office clean dispatch — open booking detail to send offer or recover.";
  }
  if (defaultAction.includes("payout")) {
    return defaultAction;
  }
  if (defaultAction.includes("triage")) {
    return "Office clean assignment needs triage — open booking detail.";
  }
  return defaultAction;
}

export type OfficeAdminBookingDetailCopy = {
  shellSubtitle: string;
  heroHeadline: string;
  contextSectionTitle: string;
  homeSizeLabel: string;
  paymentFailedNote: string;
  lifecycleDescription: string;
  assignmentSectionTitle: string;
};

export function getOfficeAdminBookingDetailCopy(): OfficeAdminBookingDetailCopy {
  return {
    shellSubtitle: "Office Cleaning — ops, payment, and workspace context",
    heroHeadline: "Commercial maintenance",
    contextSectionTitle: "Workspace context",
    homeSizeLabel: "Workspace size",
    paymentFailedNote:
      "Customer payment did not complete. No office clean assignment or earnings until payment succeeds.",
    lifecycleDescription:
      "Customer-visible workspace cleaning progress from payment through completion.",
    assignmentSectionTitle: "Office cleaning professional offers",
  };
}

export function mapAdminBookingHeroRowsForOffice<
  T extends { label: string; value: string; valueClassName?: string },
>(rows: T[], options?: { notesLabel?: string }): T[] {
  const labelMap: Record<string, string> = {
    "Home size": "Workspace size",
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

export type OfficeOperationsQueueCopy = {
  cardSubtitle: string;
  attentionFlagLabel: string | null;
  openBookingCta: string;
  sameDayNote: string | null;
};

export function getOfficeOperationsQueueCopy(input: {
  serviceLabel: string;
  scheduleLabel: string;
  scheduledStart?: string;
}): OfficeOperationsQueueCopy | null {
  if (!isOfficeOperationalBooking({ serviceLabel: input.serviceLabel })) return null;

  const badges = adminOfficeOperationalBadges({
    serviceLabel: input.serviceLabel,
    scheduledStart: input.scheduledStart,
  });
  const serviceToday = badges.some((b) => b.label === "Service today");

  return {
    cardSubtitle: "Office · commercial workspace",
    attentionFlagLabel: serviceToday ? "Service today" : "Office clean",
    openBookingCta: "Open office clean booking →",
    sameDayNote: serviceToday ? "Service today — prioritize assignment." : null,
  };
}

export type OfficeAdminCustomerBookingCardCopy = {
  serviceSubtitle: string;
  unassignedLabel: string;
};

export function getOfficeAdminCustomerBookingCardCopy(): OfficeAdminCustomerBookingCardCopy {
  return {
    serviceSubtitle: "Office workspace maintenance",
    unassignedLabel: "Office clean — unassigned",
  };
}

/** Bundled operational copy for tests. */
export function getOfficeOperationalCopy(): {
  cleanerJob: typeof getOfficeCleanerJobCopy;
  cleanerGuidance: typeof getOfficeCleanerJobGuidanceSteps;
  adminDetail: typeof getOfficeAdminBookingDetailCopy;
  adminList: typeof getOfficeAdminBookingListCopy;
} {
  return {
    cleanerJob: getOfficeCleanerJobCopy,
    cleanerGuidance: getOfficeCleanerJobGuidanceSteps,
    adminDetail: getOfficeAdminBookingDetailCopy,
    adminList: getOfficeAdminBookingListCopy,
  };
}
