/**
 * Regular Cleaning customer-facing copy (payment return, bookings list, detail).
 * Presentation only. mirrors specialty customer display modules.
 */

import type { PaymentSuccessVariant } from "@/lib/app/paymentReturnDisplay";
import {
  PAYMENT_SUCCESS_NEXT_STEPS,
  paymentSuccessLead,
  paymentSuccessTitle,
} from "@/lib/app/paymentReturnDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
  CUSTOMER_FINDING_CLEANER_LABEL,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";

export const REGULAR_CLEANING_SLUG = "regular-cleaning" as const;

export function isRegularCleaningSlug(slug: string | null | undefined): boolean {
  return slug === REGULAR_CLEANING_SLUG;
}

export type RegularCustomerSuccessCopy = {
  title: string;
  lead: string;
  nextStepsHeading: string;
  nextSteps: readonly { title: string; body: string }[];
  ctaLabel: string;
  ctaFootnote: string;
};

export function getRegularCustomerSuccessCopy(
  variant: PaymentSuccessVariant,
): RegularCustomerSuccessCopy {
  return {
    title: paymentSuccessTitle(variant),
    lead: paymentSuccessLead(variant),
    nextStepsHeading: "What happens next",
    nextSteps: PAYMENT_SUCCESS_NEXT_STEPS,
    ctaLabel: "View booking details",
    ctaFootnote: "Opening your booking…",
  };
}

export type RegularCustomerPaymentIssueCopy = {
  title: string;
  body: string;
  assignmentNote: string;
  retryGuidance: string;
  slotWarning: string;
};

export function getRegularCustomerPaymentIssueCopy(
  paymentFailureReason?: PaymentFailureReason,
): RegularCustomerPaymentIssueCopy {
  const expired = paymentFailureReason === CHECKOUT_EXPIRED_FAILURE_REASON;
  return {
    title: "Your cleaning booking is not confirmed yet",
    body: expired
      ? "Checkout timed out before payment finished. Complete payment to confirm your booking when retry is available."
      : "Complete payment to confirm your booking when retry is available.",
    assignmentNote: "Cleaner assignment begins after payment confirmation.",
    retryGuidance:
      "Open your booking and use Retry payment for a fresh secure checkout when available.",
    slotWarning: "This time slot may be released if payment is not completed.",
  };
}

export type RegularCustomerPaymentVerifyErrorCopy = {
  panelTitle: string;
  intro: string;
  nextSteps: readonly string[];
};

export function getRegularCustomerPaymentVerifyErrorCopy(): RegularCustomerPaymentVerifyErrorCopy {
  return {
    panelTitle: "Payment not confirmed yet",
    intro:
      "We couldn't confirm your payment yet. This can happen if checkout is still processing.",
    nextSteps: [
      "Wait a few seconds, then tap Try again.",
      "Open your bookings to see whether payment already went through.",
      "Contact support if you were charged but your booking still shows unpaid.",
    ],
  };
}

export type RegularCustomerBookingListCopy = {
  serviceSubtitle: string | null;
  statusBadgeLabel: string | null;
  paymentLine: string | null;
  ctaLabel: string;
};

export function getRegularCustomerBookingListCopy(input: {
  status: BookingStatus;
  paymentFailureReason: PaymentFailureReason;
  isUpcoming: boolean;
}): RegularCustomerBookingListCopy {
  const { status, paymentFailureReason, isUpcoming } = input;

  let statusBadgeLabel: string | null = null;
  switch (status) {
    case "pending_payment":
      statusBadgeLabel = "Payment needed";
      break;
    case "confirmed":
      statusBadgeLabel = "Booking confirmed";
      break;
    case "pending_assignment":
      statusBadgeLabel = CUSTOMER_FINDING_CLEANER_LABEL;
      break;
    case "assigned":
      statusBadgeLabel = "Cleaner confirmed";
      break;
    case "in_progress":
      statusBadgeLabel = "Cleaning in progress";
      break;
    case "completed":
    case "payout_ready":
    case "paid_out":
      statusBadgeLabel = "Completed";
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
  if (isUpcoming && (status === "confirmed" || status === "pending_assignment" || status === "assigned")) {
    serviceSubtitle = "Upcoming clean scheduled";
  } else if (status === "in_progress") {
    serviceSubtitle = "Your clean is in progress";
  }

  let paymentLine: string | null = null;
  if (status === "pending_payment") {
    paymentLine = "Complete checkout to confirm your booking";
  }

  return {
    serviceSubtitle,
    statusBadgeLabel,
    paymentLine,
    ctaLabel: "View details",
  };
}

export type RegularCustomerBookingDetailCopy = {
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

export function getRegularCustomerBookingDetailCopy(): RegularCustomerBookingDetailCopy {
  return {
    shellSubtitle: "Status, payment, and service details",
    detailsSectionTitle: "Booking details",
    activitySectionTitle: "Activity",
    homeSizeLabel: "Home size",
    frequencyLabel: "Preferred schedule",
    addonsLabel: "Extras",
    notesLabel: "Special instructions",
    cleanerPreferenceLabel: "Cleaner preference",
    assignedCleanerLabel: "Assigned cleaner",
    serviceHeroTitle: "Your scheduled clean",
  };
}

export function customerRegularCompactGuidance(
  status: BookingStatus,
): { primary: string; secondary?: string | null } | null {
  switch (status) {
    case "pending_payment":
      return {
        primary: "Complete secure checkout to confirm your booking.",
        secondary: "Cleaner assignment begins after payment confirmation.",
      };
    case "confirmed":
      return {
        primary: "We'll match a cleaner and email you when they're assigned.",
      };
    case "pending_assignment":
      return {
        primary: "We're finding your cleaner for your schedule and preferences.",
      };
    case "assigned":
      return {
        primary: "Your cleaner is confirmed. check back before your scheduled time.",
      };
    case "in_progress":
      return {
        primary: "Your clean is in progress.",
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        primary: "Booking complete. Thank you for choosing us.",
      };
    default:
      return null;
  }
}
