/**
 * Airbnb Cleaning customer-facing copy (payment return, bookings list, detail).
 * Presentation only — no payment, lifecycle, or dispatch behavior.
 */

import type { PaymentSuccessVariant } from "@/lib/app/paymentReturnDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import {
  isAirbnbCleaningSlug,
  AIRBNB_CLEANING_SLUG,
  customerAirbnbStatusLine,
  customerAirbnbTimingHint,
} from "@/features/booking-wizard/airbnbCleaningDisplay";

export {
  isAirbnbCleaningSlug,
  isAirbnbCleaningSlug as isAirbnbCleaningService,
  AIRBNB_CLEANING_SLUG,
  customerAirbnbStatusLine,
  customerAirbnbTimingHint,
};

export type AirbnbCustomerSuccessCopy = {
  title: string;
  lead: string;
  nextStepsHeading: string;
  nextSteps: readonly { title: string; body: string }[];
  guestReadyNote: string;
  ctaLabel: string;
  ctaFootnote: string;
};

export function getAirbnbCustomerSuccessCopy(
  variant: PaymentSuccessVariant,
): AirbnbCustomerSuccessCopy {
  const already = variant === "already_confirmed";
  return {
    title: already ? "Turnover payment already confirmed" : "Your Airbnb turnover is confirmed",
    lead: already
      ? "Your payment is on file. Opening your turnover booking now."
      : "Your payment was successful. We're opening your turnover booking now.",
    nextStepsHeading: "What happens next",
    nextSteps: [
      {
        title: "Turnover confirmed",
        body: "Your payment is on file and your turnover is booked.",
      },
      {
        title: "Cleaner assignment",
        body: "We'll start assigning a cleaner for your guest-ready preparation.",
      },
      {
        title: "Turnover details",
        body: "Your schedule, property, and host instructions are on your booking page.",
      },
      {
        title: "Email updates",
        body: "We'll email confirmation and any changes before your turnover.",
      },
    ],
    guestReadyNote:
      "Your property is scheduled to be prepared before the next guest arrival.",
    ctaLabel: "View turnover details",
    ctaFootnote: "Opening your turnover booking…",
  };
}

export type AirbnbCustomerPaymentIssueCopy = {
  title: string;
  body: string;
  assignmentNote: string;
  retryGuidance: string;
  slotWarning: string;
};

export function getAirbnbCustomerPaymentIssueCopy(
  paymentFailureReason?: PaymentFailureReason,
): AirbnbCustomerPaymentIssueCopy {
  const expired = paymentFailureReason === CHECKOUT_EXPIRED_FAILURE_REASON;
  return {
    title: "Your Airbnb turnover booking is not confirmed yet",
    body: expired
      ? "Checkout timed out before payment finished. Complete payment to secure your property preparation slot."
      : "Complete payment to secure your property preparation slot.",
    assignmentNote:
      "Cleaner assignment begins after payment confirmation.",
    retryGuidance:
      "Open your turnover booking and use Retry payment for a fresh secure checkout when available.",
    slotWarning: "This turnover slot may be released if payment is not completed.",
  };
}

export type AirbnbCustomerPaymentVerifyErrorCopy = {
  panelTitle: string;
  intro: string;
  nextSteps: readonly string[];
};

export function getAirbnbCustomerPaymentVerifyErrorCopy(): AirbnbCustomerPaymentVerifyErrorCopy {
  return {
    panelTitle: "Turnover payment not confirmed yet",
    intro:
      "We couldn't confirm your payment yet. This can happen if checkout is still processing.",
    nextSteps: [
      "Wait a few seconds, then tap Try again.",
      "Open your bookings to see whether payment already went through.",
      "Contact support if you were charged but your turnover still shows unpaid.",
    ],
  };
}

export type AirbnbCustomerBookingListCopy = {
  serviceSubtitle: string | null;
  statusBadgeLabel: string | null;
  paymentLine: string | null;
  ctaLabel: string;
};

export function getAirbnbCustomerBookingListCopy(input: {
  status: BookingStatus;
  paymentFailureReason: PaymentFailureReason;
  isUpcoming: boolean;
}): AirbnbCustomerBookingListCopy {
  const { status, paymentFailureReason, isUpcoming } = input;

  let statusBadgeLabel: string | null = null;
  switch (status) {
    case "pending_payment":
      statusBadgeLabel = "Payment needed";
      break;
    case "confirmed":
      statusBadgeLabel = "Turnover confirmed";
      break;
    case "pending_assignment":
      statusBadgeLabel = "Cleaner assignment in progress";
      break;
    case "assigned":
      statusBadgeLabel = "Cleaner confirmed";
      break;
    case "in_progress":
      statusBadgeLabel = "Turnover in progress";
      break;
    case "completed":
    case "payout_ready":
    case "paid_out":
      statusBadgeLabel = "Turnover completed";
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
    serviceSubtitle = "Preparing for your next guest";
  } else if (status === "completed" || status === "payout_ready" || status === "paid_out") {
    serviceSubtitle = "Turnover completed";
  } else if (isUpcoming) {
    serviceSubtitle =
      status === "confirmed" || status === "pending_assignment" || status === "assigned"
        ? "Guest-ready preparation scheduled"
        : "Upcoming turnover clean";
  }

  let paymentLine: string | null = null;
  if (status === "payment_failed") {
    paymentLine = "Complete payment to secure your turnover slot";
  } else if (status === "pending_payment") {
    paymentLine = "Complete checkout to secure your turnover slot";
  }

  return {
    serviceSubtitle,
    statusBadgeLabel,
    paymentLine,
    ctaLabel: "View turnover",
  };
}

export type AirbnbCustomerBookingDetailCopy = {
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

export function getAirbnbCustomerBookingDetailCopy(): AirbnbCustomerBookingDetailCopy {
  return {
    shellSubtitle: "Turnover status, payment, and property details",
    detailsSectionTitle: "Turnover details",
    activitySectionTitle: "Activity",
    homeSizeLabel: "Property size",
    frequencyLabel: "Turnover cadence",
    addonsLabel: "Turnover extras",
    notesLabel: "Host instructions",
    cleanerPreferenceLabel: "Cleaner preference",
    assignedCleanerLabel: "Turnover cleaner",
    serviceHeroTitle: "Guest-ready turnover",
  };
}

export function customerAirbnbCompactGuidance(
  status: BookingStatus,
): { primary: string; secondary?: string | null } | null {
  switch (status) {
    case "pending_payment":
      return {
        primary: "Complete secure checkout to confirm your turnover.",
        secondary: "Cleaner assignment begins after payment confirmation.",
      };
    case "confirmed":
      return {
        primary:
          "We'll match a turnover cleaner and email you when they're assigned.",
      };
    case "pending_assignment":
      return {
        primary: "Cleaner assignment is in progress for your turnover schedule.",
        secondary: "Status updates appear in Activity below.",
      };
    case "assigned":
      return {
        primary: "Check this page on turnover day for any last-minute updates.",
      };
    case "in_progress":
      return {
        primary: "Your property is being prepared for the next guest.",
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        primary: "Prepared for guest arrival — thank you for hosting with us.",
      };
    default:
      return null;
  }
}

/** Parses optional `service` query param from payment return URLs. */
export function parsePaymentReturnServiceSlug(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed && isAirbnbCleaningSlug(trimmed) ? trimmed : null;
}
