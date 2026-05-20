/**
 * Move In/Out Cleaning customer-facing copy (payment return, bookings list, detail).
 * Presentation only — no payment, lifecycle, or dispatch behavior.
 */

import type { PaymentSuccessVariant } from "@/lib/app/paymentReturnDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
  CUSTOMER_FINDING_CLEANER_LABEL,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import {
  isMovingCleaningSlug,
  MOVING_CLEANING_SLUG,
  customerMovingStatusLine,
  customerMovingTimingHint,
} from "@/features/booking-wizard/movingCleaningDisplay";

export {
  isMovingCleaningSlug,
  isMovingCleaningSlug as isMovingCleaningService,
  MOVING_CLEANING_SLUG,
  customerMovingStatusLine,
  customerMovingTimingHint,
};

export type MovingCustomerSuccessCopy = {
  title: string;
  lead: string;
  nextStepsHeading: string;
  nextSteps: readonly { title: string; body: string }[];
  moveReadyNote: string;
  ctaLabel: string;
  ctaFootnote: string;
};

export function getMovingCustomerSuccessCopy(
  variant: PaymentSuccessVariant,
): MovingCustomerSuccessCopy {
  const already = variant === "already_confirmed";
  return {
    title: already ? "Move clean payment already confirmed" : "Your move cleaning is scheduled",
    lead: already
      ? "Your payment is on file. Opening your move preparation booking now."
      : "Your payment was successful. We'll prepare your property before move-in or inspection.",
    nextStepsHeading: "What happens next",
    nextSteps: [
      {
        title: "Move clean confirmed",
        body: "Your payment is on file and your move preparation is booked.",
      },
      {
        title: "Cleaner assignment",
        body: "Cleaner assignment begins after payment confirmation.",
      },
      {
        title: "Property details",
        body: "Schedule, access, and move instructions are on your booking page.",
      },
      {
        title: "Email updates",
        body: "We'll email confirmation and any changes before your scheduled clean.",
      },
    ],
    moveReadyNote:
      "Your property is scheduled to be prepared before move-in, handover, or inspection.",
    ctaLabel: "View move preparation details",
    ctaFootnote: "Opening your move cleaning booking…",
  };
}

export type MovingCustomerPaymentIssueCopy = {
  title: string;
  body: string;
  assignmentNote: string;
  retryGuidance: string;
  slotWarning: string;
};

export function getMovingCustomerPaymentIssueCopy(
  paymentFailureReason?: PaymentFailureReason,
): MovingCustomerPaymentIssueCopy {
  const expired = paymentFailureReason === CHECKOUT_EXPIRED_FAILURE_REASON;
  return {
    title: "Your move cleaning booking is not confirmed yet",
    body: expired
      ? "Checkout timed out before payment finished. Complete payment to secure your move preparation slot."
      : "Complete payment to secure your move preparation slot.",
    assignmentNote: "Cleaner assignment begins after payment confirmation.",
    retryGuidance:
      "Open your booking and use Retry payment for a fresh secure checkout when available.",
    slotWarning: "This move preparation slot may be released if payment is not completed.",
  };
}

export type MovingCustomerPaymentVerifyErrorCopy = {
  panelTitle: string;
  intro: string;
  nextSteps: readonly string[];
};

export function getMovingCustomerPaymentVerifyErrorCopy(): MovingCustomerPaymentVerifyErrorCopy {
  return {
    panelTitle: "Move clean payment not confirmed yet",
    intro:
      "We couldn't confirm your payment yet. This can happen if checkout is still processing.",
    nextSteps: [
      "Wait a few seconds, then tap Try again.",
      "Open your bookings to see whether payment already went through.",
      "Contact support if you were charged but your move clean still shows unpaid.",
    ],
  };
}

export type MovingCustomerBookingListCopy = {
  serviceSubtitle: string | null;
  statusBadgeLabel: string | null;
  paymentLine: string | null;
  ctaLabel: string;
};

export function getMovingCustomerBookingListCopy(input: {
  status: BookingStatus;
  paymentFailureReason: PaymentFailureReason;
  isUpcoming: boolean;
}): MovingCustomerBookingListCopy {
  const { status, paymentFailureReason, isUpcoming } = input;

  let statusBadgeLabel: string | null = null;
  switch (status) {
    case "pending_payment":
      statusBadgeLabel = "Payment needed";
      break;
    case "confirmed":
      statusBadgeLabel = "Move preparation scheduled";
      break;
    case "pending_assignment":
      statusBadgeLabel = CUSTOMER_FINDING_CLEANER_LABEL;
      break;
    case "assigned":
      statusBadgeLabel = "Cleaner confirmed";
      break;
    case "in_progress":
      statusBadgeLabel = "Inspection-ready cleaning";
      break;
    case "completed":
    case "payout_ready":
    case "paid_out":
      statusBadgeLabel = "Move clean completed";
      break;
    case "payment_failed":
      statusBadgeLabel =
        paymentFailureReason === CHECKOUT_EXPIRED_FAILURE_REASON
          ? "Checkout not completed"
          : "Payment not completed";
      break;
    default:
      break;
  }

  let serviceSubtitle: string | null = null;
  if (status === "in_progress") {
    serviceSubtitle = "Preparing property for handover or occupancy";
  } else if (status === "completed" || status === "payout_ready" || status === "paid_out") {
    serviceSubtitle = "Inspection-ready cleaning complete";
  } else if (isUpcoming) {
    serviceSubtitle =
      status === "confirmed" || status === "pending_assignment" || status === "assigned"
        ? "Move preparation scheduled"
        : "Upcoming move clean";
  }

  let paymentLine: string | null = null;
  if (status === "payment_failed") {
    paymentLine = "Complete payment to secure your move preparation slot";
  } else if (status === "pending_payment") {
    paymentLine = "Complete checkout to secure your move preparation slot";
  }

  return {
    serviceSubtitle,
    statusBadgeLabel,
    paymentLine,
    ctaLabel: "View move details",
  };
}

export type MovingCustomerBookingDetailCopy = {
  shellSubtitle: string;
  detailsSectionTitle: string;
  activitySectionTitle: string;
  homeSizeLabel: string;
  frequencyLabel: string;
  addonsLabel: string;
  notesLabel: string;
  cleanerPreferenceLabel: string;
  assignedCleanerLabel: string;
  serviceHeroTitle: string;
};

export function getMovingCustomerBookingDetailCopy(): MovingCustomerBookingDetailCopy {
  return {
    shellSubtitle: "Move preparation status, payment, and property details",
    detailsSectionTitle: "Move preparation details",
    activitySectionTitle: "Activity",
    homeSizeLabel: "Property size",
    frequencyLabel: "Visit timing",
    addonsLabel: "Inspection extras",
    notesLabel: "Move instructions",
    cleanerPreferenceLabel: "Cleaner preference",
    assignedCleanerLabel: "Move preparation cleaner",
    serviceHeroTitle: "Move In/Out Cleaning",
  };
}

export function customerMovingCompactGuidance(
  status: BookingStatus,
): { primary: string; secondary?: string | null } | null {
  switch (status) {
    case "pending_payment":
      return {
        primary: "Complete secure checkout to confirm your move preparation.",
        secondary: "Cleaner assignment begins after payment confirmation.",
      };
    case "confirmed":
      return {
        primary:
          "We'll match a move preparation cleaner and email you when they're assigned.",
      };
    case "pending_assignment":
      return {
        primary: "We're finding your cleaner for your move schedule.",
        secondary: "Status updates appear in Activity below.",
      };
    case "assigned":
      return {
        primary: "Check this page on handover day for any last-minute updates.",
      };
    case "in_progress":
      return {
        primary: "Your property is being prepared for handover or occupancy.",
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        primary: "Property prepared for handover or move-in — thank you.",
      };
    default:
      return null;
  }
}

/** Parses optional `service` query param from payment return URLs. */
export function parseMovingPaymentReturnServiceSlug(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed && isMovingCleaningSlug(trimmed) ? trimmed : null;
}
