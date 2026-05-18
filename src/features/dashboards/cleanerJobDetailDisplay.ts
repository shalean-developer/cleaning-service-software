import type { BookingStatus } from "@/features/bookings/server/types";
import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";
import { toneForCleanerJobStatus } from "@/features/bookings/server/statusLabels";

/** Shared card shell for cleaner job/offer surfaces (presentation only). */
export const CLEANER_DETAIL_CARD_CLASS =
  "rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

export const CLEANER_DETAIL_INSET_CLASS =
  "rounded-xl border border-zinc-200 bg-zinc-50/80";

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
        description: "You're scheduled for this clean. Review the details below before you arrive.",
        expectedUpdate: "Start the job when you begin on site",
      };
    case "in_progress":
      return {
        description: "This job is in progress. Mark it complete when the clean is finished.",
        expectedUpdate: "During your scheduled window",
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        description: "This job is complete. Payout details appear below when available.",
        expectedUpdate: null,
      };
    case "pending_assignment":
      return {
        description: "This booking is still being confirmed. Check back for updates.",
        expectedUpdate: null,
      };
    default:
      return {
        description: "Job details and updates are shown below.",
        expectedUpdate: null,
      };
  }
}

export function cleanerJobStatusHero(status: BookingStatus): CleanerJobHeroPresentation {
  const copy = heroCopyForCleanerJob(status);
  return {
    ...copy,
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
): CleanerJobWhatHappensNextPresentation | null {
  switch (status) {
    case "assigned":
      return {
        title: "What to do next",
        steps: [
          {
            title: "Review the job",
            body: "Check the schedule, location, and any customer notes before you travel.",
          },
          {
            title: "Start on site",
            body: "Tap Start job when you begin the clean at the property.",
          },
          {
            title: "Mark complete",
            body: "Tap Mark complete when the work is finished.",
          },
        ],
      };
    case "in_progress":
      return {
        title: "What to do next",
        steps: [
          {
            title: "Finish the clean",
            body: "Complete the service during your scheduled window.",
          },
          {
            title: "Mark complete",
            body: "Tap Mark complete so we can confirm the job and process your pay.",
          },
          {
            title: "Payout",
            body: "Your earnings appear below once the job is confirmed.",
          },
        ],
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        title: "What happens next",
        steps: [
          {
            title: "Job recorded",
            body: "This clean is logged as complete in your history.",
          },
          {
            title: "Payout processing",
            body: "Pay status updates below as your earnings move through payout.",
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
