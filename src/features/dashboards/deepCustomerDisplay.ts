/**
 * Deep Cleaning customer-facing copy (payment return, bookings list, detail).
 * Presentation only. no payment, lifecycle, or dispatch behavior.
 */

import type { PaymentSuccessVariant } from "@/lib/app/paymentReturnDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
  CUSTOMER_FINDING_CLEANER_LABEL,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import {
  isDeepCleaningSlug,
  DEEP_CLEANING_SLUG,
  customerDeepStatusLine,
  customerDeepTimingHint,
} from "@/features/booking-wizard/deepCleaningDisplay";

export {
  isDeepCleaningSlug,
  isDeepCleaningSlug as isDeepCleaningService,
  DEEP_CLEANING_SLUG,
  customerDeepStatusLine,
  customerDeepTimingHint,
};

export type DeepCustomerSuccessCopy = {
  title: string;
  lead: string;
  nextStepsHeading: string;
  nextSteps: readonly { title: string; body: string }[];
  restorationNote: string;
  ctaLabel: string;
  ctaFootnote: string;
};

export function getDeepCustomerSuccessCopy(
  variant: PaymentSuccessVariant,
): DeepCustomerSuccessCopy {
  const already = variant === "already_confirmed";
  return {
    title: already ? "Deep clean payment already confirmed" : "Your deep cleaning is scheduled",
    lead: already
      ? "Your payment is on file. Opening your deep cleaning booking now."
      : "Your payment was successful. Your home will receive detailed restoration-focused cleaning.",
    nextStepsHeading: "What happens next",
    nextSteps: [
      {
        title: "Deep clean confirmed",
        body: "Your payment is on file and your intensive cleaning is booked.",
      },
      {
        title: "Cleaner assignment",
        body: "Cleaner assignment begins after payment confirmation.",
      },
      {
        title: "Home details",
        body: "Schedule, access, and attention areas are on your booking page.",
      },
      {
        title: "Email updates",
        body: "We'll email confirmation and any changes before your scheduled clean.",
      },
    ],
    restorationNote:
      "Your home will receive detailed restoration-focused cleaning on your scheduled date.",
    ctaLabel: "View deep cleaning details",
    ctaFootnote: "Opening your deep cleaning booking…",
  };
}

export type DeepCustomerPaymentIssueCopy = {
  title: string;
  body: string;
  assignmentNote: string;
  retryGuidance: string;
  slotWarning: string;
};

export function getDeepCustomerPaymentIssueCopy(
  paymentFailureReason?: PaymentFailureReason,
): DeepCustomerPaymentIssueCopy {
  const expired = paymentFailureReason === CHECKOUT_EXPIRED_FAILURE_REASON;
  return {
    title: "Your deep cleaning booking is not confirmed yet",
    body: expired
      ? "Checkout timed out before payment finished. Complete payment to secure your deep cleaning slot."
      : "Complete payment to secure your deep cleaning slot.",
    assignmentNote: "Cleaner assignment begins after payment confirmation.",
    retryGuidance:
      "Open your booking and use Retry payment for a fresh secure checkout when available.",
    slotWarning: "This deep cleaning slot may be released if payment is not completed.",
  };
}

export type DeepCustomerPaymentVerifyErrorCopy = {
  panelTitle: string;
  intro: string;
  nextSteps: readonly string[];
};

export function getDeepCustomerPaymentVerifyErrorCopy(): DeepCustomerPaymentVerifyErrorCopy {
  return {
    panelTitle: "Deep clean payment not confirmed yet",
    intro:
      "We couldn't confirm your payment yet. This can happen if checkout is still processing.",
    nextSteps: [
      "Wait a few seconds, then tap Try again.",
      "Open your bookings to see whether payment already went through.",
      "Contact support if you were charged but your deep clean still shows unpaid.",
    ],
  };
}

export type DeepCustomerBookingListCopy = {
  serviceSubtitle: string | null;
  statusBadgeLabel: string | null;
  paymentLine: string | null;
  ctaLabel: string;
};

export function getDeepCustomerBookingListCopy(input: {
  status: BookingStatus;
  paymentFailureReason: PaymentFailureReason;
  isUpcoming: boolean;
}): DeepCustomerBookingListCopy {
  const { status, paymentFailureReason, isUpcoming } = input;

  let statusBadgeLabel: string | null = null;
  switch (status) {
    case "pending_payment":
      statusBadgeLabel = "Payment needed";
      break;
    case "confirmed":
      statusBadgeLabel = "Deep-clean preparation scheduled";
      break;
    case "pending_assignment":
      statusBadgeLabel = CUSTOMER_FINDING_CLEANER_LABEL;
      break;
    case "assigned":
      statusBadgeLabel = "Cleaner confirmed";
      break;
    case "in_progress":
      statusBadgeLabel = "Detailed cleaning in progress";
      break;
    case "completed":
    case "payout_ready":
    case "paid_out":
      statusBadgeLabel = "Home restoration complete";
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
    serviceSubtitle = "Intensive restoration cleaning in progress";
  } else if (status === "completed" || status === "payout_ready" || status === "paid_out") {
    serviceSubtitle = "Detailed home refresh complete";
  } else if (isUpcoming) {
    serviceSubtitle =
      status === "confirmed" || status === "pending_assignment" || status === "assigned"
        ? "Deep-clean preparation scheduled"
        : "Upcoming deep clean";
  }

  let paymentLine: string | null = null;
  if (status === "payment_failed") {
    paymentLine = "Complete payment to secure your deep cleaning slot";
  } else if (status === "pending_payment") {
    paymentLine = "Complete checkout to secure your deep cleaning slot";
  }

  return {
    serviceSubtitle,
    statusBadgeLabel,
    paymentLine,
    ctaLabel: "View deep clean details",
  };
}

export type DeepCustomerBookingDetailCopy = {
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

export function getDeepCustomerBookingDetailCopy(): DeepCustomerBookingDetailCopy {
  return {
    shellSubtitle: "Deep cleaning status, payment, and restoration details",
    detailsSectionTitle: "Deep-clean priorities",
    activitySectionTitle: "Activity",
    homeSizeLabel: "Home size",
    frequencyLabel: "Visit timing",
    addonsLabel: "Detailed cleaning extras",
    notesLabel: "Attention areas",
    cleanerPreferenceLabel: "Cleaner preference",
    assignedCleanerLabel: "Deep cleaning cleaner",
    serviceHeroTitle: "Deep Cleaning",
  };
}

export function customerDeepCompactGuidance(
  status: BookingStatus,
): { primary: string; secondary?: string | null } | null {
  switch (status) {
    case "pending_payment":
      return {
        primary: "Complete secure checkout to confirm your deep cleaning.",
        secondary: "Cleaner assignment begins after payment confirmation.",
      };
    case "confirmed":
      return {
        primary:
          "We'll match a detail-oriented cleaner and email you when they're assigned.",
      };
    case "pending_assignment":
      return {
        primary: "We're finding your cleaner for your deep clean schedule.",
        secondary: "Status updates appear in Activity below.",
      };
    case "assigned":
      return {
        primary: "Prepare priority areas and secure fragile items before arrival.",
      };
    case "in_progress":
      return {
        primary: "Your home is receiving detailed restoration-focused cleaning.",
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        primary: "Home restoration complete. thank you.",
      };
    default:
      return null;
  }
}

/** Parses optional `service` query param from payment return URLs. */
export function parseDeepPaymentReturnServiceSlug(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed && isDeepCleaningSlug(trimmed) ? trimmed : null;
}
