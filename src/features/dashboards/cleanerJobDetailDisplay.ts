import type { BookingStatus } from "@/features/bookings/server/types";
import {
  cleanerAirbnbExpectedUpdate,
  cleanerAirbnbJobDescription,
  isAirbnbCleaningSlug,
} from "@/features/booking-wizard/airbnbCleaningDisplay";
import {
  cleanerDeepExpectedUpdate,
  cleanerDeepJobDescription,
  isDeepCleaningSlug,
} from "@/features/booking-wizard/deepCleaningDisplay";
import {
  cleanerCarpetExpectedUpdate,
  cleanerCarpetJobDescription,
  isCarpetCleaningSlug,
} from "@/features/booking-wizard/carpetCleaningDisplay";
import {
  cleanerMovingExpectedUpdate,
  cleanerMovingJobDescription,
  isMovingCleaningSlug,
} from "@/features/booking-wizard/movingCleaningDisplay";
import {
  cleanerOfficeExpectedUpdate,
  cleanerOfficeJobDescription,
  isOfficeCleaningSlug,
} from "@/features/booking-wizard/officeCleaningDisplay";
import {
  cleanerAirbnbJobStatusLabel,
  getAirbnbCleanerJobGuidanceSteps,
  isAirbnbOperationalBooking,
} from "@/features/dashboards/airbnbOperationalDisplay";
import {
  cleanerDeepJobStatusLabel,
  getDeepCleanerJobGuidanceSteps,
  isDeepOperationalBooking,
} from "@/features/dashboards/deepOperationalDisplay";
import {
  cleanerCarpetJobStatusLabel,
  getCarpetCleanerJobGuidanceSteps,
  isCarpetOperationalBooking,
} from "@/features/dashboards/carpetOperationalDisplay";
import {
  cleanerMovingJobStatusLabel,
  getMovingCleanerJobGuidanceSteps,
  isMovingOperationalBooking,
} from "@/features/dashboards/movingOperationalDisplay";
import {
  cleanerOfficeJobStatusLabel,
  getOfficeCleanerJobGuidanceSteps,
  isOfficeOperationalBooking,
} from "@/features/dashboards/officeOperationalDisplay";
import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";
import {
  labelForCleanerJobStatus,
  toneForCleanerJobStatus,
} from "@/features/bookings/server/statusLabels";
import { LIFECYCLE_GUIDANCE_PANEL_TITLE } from "@/lib/app/dashboardEcosystemDisplay";

import { UI_CARD_SHELL_CLASS, UI_INSET_PANEL_CLASS } from "@/lib/ui/productUiTokens";

/** Shared card shell for cleaner job/offer surfaces (presentation only). */
export const CLEANER_DETAIL_CARD_CLASS = UI_CARD_SHELL_CLASS;

export const CLEANER_DETAIL_INSET_CLASS = UI_INSET_PANEL_CLASS;

export type CleanerJobStatusLabelContext = {
  serviceSlug?: string | null;
  serviceLabel?: string | null;
};

/** Unified cleaner job status badge (list + detail parity). */
export function resolveCleanerJobStatusLabel(
  status: BookingStatus,
  context?: CleanerJobStatusLabelContext,
): string {
  const booking = {
    serviceSlug: context?.serviceSlug,
    serviceLabel: context?.serviceLabel,
  };
  if (isAirbnbOperationalBooking(booking)) {
    return cleanerAirbnbJobStatusLabel(status) ?? labelForCleanerJobStatus(status);
  }
  if (isOfficeOperationalBooking(booking)) {
    return cleanerOfficeJobStatusLabel(status) ?? labelForCleanerJobStatus(status);
  }
  if (isMovingOperationalBooking(booking)) {
    return cleanerMovingJobStatusLabel(status) ?? labelForCleanerJobStatus(status);
  }
  if (isDeepOperationalBooking(booking)) {
    return cleanerDeepJobStatusLabel(status) ?? labelForCleanerJobStatus(status);
  }
  if (isCarpetOperationalBooking(booking)) {
    return cleanerCarpetJobStatusLabel(status) ?? labelForCleanerJobStatus(status);
  }
  return labelForCleanerJobStatus(status);
}

export type CleanerJobHeroPresentation = {
  description: string;
  expectedUpdate: string | null;
  tone: StatusBadgeTone;
};

function heroCopyForCleanerJob(
  status: BookingStatus,
): Pick<CleanerJobHeroPresentation, "description" | "expectedUpdate"> {
  switch (status) {
    case "assigned":
      return {
        description: "You're scheduled for this clean.",
        expectedUpdate: "Start the job when you begin on site",
      };
    case "in_progress":
      return {
        description: "Job in progress — mark complete when finished.",
        expectedUpdate: "Mark complete during your scheduled window",
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        description: "Job complete. Payout status is below.",
        expectedUpdate: null,
      };
    case "pending_assignment":
      return {
        description: "Awaiting confirmation.",
        expectedUpdate: null,
      };
    default:
      return {
        description: "Details below.",
        expectedUpdate: null,
      };
  }
}

export function cleanerJobStatusHero(
  status: BookingStatus,
  serviceSlug?: string | null,
): CleanerJobHeroPresentation {
  const copy = heroCopyForCleanerJob(status);
  const airbnb = isAirbnbCleaningSlug(serviceSlug);
  const office = isOfficeCleaningSlug(serviceSlug);
  const moving = isMovingCleaningSlug(serviceSlug);
  const deep = isDeepCleaningSlug(serviceSlug);
  const carpet = isCarpetCleaningSlug(serviceSlug);
  return {
    description: airbnb
      ? cleanerAirbnbJobDescription(status, copy.description)
      : office
        ? cleanerOfficeJobDescription(status, copy.description)
        : moving
          ? cleanerMovingJobDescription(status, copy.description)
          : deep
            ? cleanerDeepJobDescription(status, copy.description)
            : carpet
              ? cleanerCarpetJobDescription(status, copy.description)
              : copy.description,
    expectedUpdate: airbnb
      ? cleanerAirbnbExpectedUpdate(status, copy.expectedUpdate)
      : office
        ? cleanerOfficeExpectedUpdate(status, copy.expectedUpdate)
        : moving
          ? cleanerMovingExpectedUpdate(status, copy.expectedUpdate)
          : deep
            ? cleanerDeepExpectedUpdate(status, copy.expectedUpdate)
            : carpet
              ? cleanerCarpetExpectedUpdate(status, copy.expectedUpdate)
              : copy.expectedUpdate,
    tone: toneForCleanerJobStatus(status),
  };
}

export type CleanerJobNextStep = {
  title: string;
  body: string;
};

export type CleanerJobWhatHappensNextPresentation = {
  title: string;
  steps: readonly CleanerJobNextStep[];
};

/** Informational next steps keyed by job status (no lifecycle logic). */
export function cleanerJobWhatHappensNext(
  status: BookingStatus,
  options?: { serviceSlug?: string | null; serviceLabel?: string | null },
): CleanerJobWhatHappensNextPresentation | null {
  if (
    isAirbnbOperationalBooking({
      serviceSlug: options?.serviceSlug,
      serviceLabel: options?.serviceLabel,
    })
  ) {
    const steps = getAirbnbCleanerJobGuidanceSteps(status);
    if (!steps || steps.length === 0) return null;
    return {
      title: "Turnover guidance",
      steps,
    };
  }

  if (
    isMovingOperationalBooking({
      serviceSlug: options?.serviceSlug,
      serviceLabel: options?.serviceLabel,
    })
  ) {
    const steps = getMovingCleanerJobGuidanceSteps(status);
    if (!steps || steps.length === 0) return null;
    return {
      title: "Move preparation guidance",
      steps,
    };
  }

  if (
    isDeepOperationalBooking({
      serviceSlug: options?.serviceSlug,
      serviceLabel: options?.serviceLabel,
    })
  ) {
    const steps = getDeepCleanerJobGuidanceSteps(status);
    if (!steps || steps.length === 0) return null;
    return {
      title: "Deep cleaning guidance",
      steps,
    };
  }

  if (
    isOfficeOperationalBooking({
      serviceSlug: options?.serviceSlug,
      serviceLabel: options?.serviceLabel,
    })
  ) {
    const steps = getOfficeCleanerJobGuidanceSteps(status);
    if (!steps || steps.length === 0) return null;
    return {
      title: "Workspace cleaning guidance",
      steps,
    };
  }

  if (
    isCarpetOperationalBooking({
      serviceSlug: options?.serviceSlug,
      serviceLabel: options?.serviceLabel,
    })
  ) {
    const steps = getCarpetCleanerJobGuidanceSteps(status);
    if (!steps || steps.length === 0) return null;
    return {
      title: "Carpet & floor-care guidance",
      steps,
    };
  }

  switch (status) {
    case "assigned":
      return {
        title: LIFECYCLE_GUIDANCE_PANEL_TITLE,
        steps: [
          {
            title: "Review details",
            body: "Check schedule, location, and customer notes.",
          },
          {
            title: "Start on site",
            body: "Tap Start job when you begin.",
          },
          {
            title: "Mark complete",
            body: "Tap Mark complete when finished.",
          },
        ],
      };
    case "in_progress":
      return {
        title: LIFECYCLE_GUIDANCE_PANEL_TITLE,
        steps: [
          {
            title: "Finish the clean",
            body: "Complete during your scheduled window.",
          },
          {
            title: "Mark complete",
            body: "Tap Mark complete to confirm the job.",
          },
          {
            title: "Payout",
            body: "Earnings update below after confirmation.",
          },
        ],
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        title: LIFECYCLE_GUIDANCE_PANEL_TITLE,
        steps: [
          {
            title: "Job recorded",
            body: "Logged as complete in your history.",
          },
          {
            title: "Payout processing",
            body: "Pay status updates below.",
          },
        ],
      };
    default:
      return null;
  }
}

export function cleanerOfferSectionTitle(needsResponse: boolean): string {
  return needsResponse ? "Needs your response" : "Past offers";
}
