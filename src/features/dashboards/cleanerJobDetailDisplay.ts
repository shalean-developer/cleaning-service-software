import type { BookingStatus } from "@/features/bookings/server/types";
import {
  cleanerAirbnbExpectedUpdate,
  cleanerAirbnbJobDescription,
  isAirbnbCleaningSlug,
} from "@/features/booking-wizard/airbnbCleaningDisplay";
import {
  getAirbnbCleanerJobGuidanceSteps,
  isAirbnbOperationalBooking,
} from "@/features/dashboards/airbnbOperationalDisplay";
import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";
import { toneForCleanerJobStatus } from "@/features/bookings/server/statusLabels";
import { LIFECYCLE_GUIDANCE_PANEL_TITLE } from "@/lib/app/dashboardEcosystemDisplay";

import { UI_CARD_SHELL_CLASS, UI_INSET_PANEL_CLASS } from "@/lib/ui/productUiTokens";

/** Shared card shell for cleaner job/offer surfaces (presentation only). */
export const CLEANER_DETAIL_CARD_CLASS = UI_CARD_SHELL_CLASS;

export const CLEANER_DETAIL_INSET_CLASS = UI_INSET_PANEL_CLASS;

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
  return {
    description: airbnb
      ? cleanerAirbnbJobDescription(status, copy.description)
      : copy.description,
    expectedUpdate: airbnb
      ? cleanerAirbnbExpectedUpdate(status, copy.expectedUpdate)
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
