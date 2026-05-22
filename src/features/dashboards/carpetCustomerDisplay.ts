/**
 * Carpet Cleaning customer-facing copy (payment return, bookings list, detail).
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
  CARPET_CLEANING_SLUG,
  customerCarpetStatusLine,
  customerCarpetTimingHint,
  isCarpetCleaningSlug,
} from "@/features/booking-wizard/carpetCleaningDisplay";

export {
  isCarpetCleaningSlug,
  isCarpetCleaningSlug as isCarpetCleaningService,
  CARPET_CLEANING_SLUG,
  customerCarpetStatusLine,
  customerCarpetTimingHint,
};

export type CarpetCustomerSuccessCopy = {
  title: string;
  lead: string;
  nextStepsHeading: string;
  nextSteps: readonly { title: string; body: string }[];
  floorCareNote: string;
  ctaLabel: string;
  ctaFootnote: string;
};

export function getCarpetCustomerSuccessCopy(
  variant: PaymentSuccessVariant,
): CarpetCustomerSuccessCopy {
  const already = variant === "already_confirmed";
  return {
    title: already ? "Carpet cleaning payment already confirmed" : "Your carpet cleaning is scheduled",
    lead: already
      ? "Your payment is on file. Opening your carpet cleaning booking now."
      : "Your payment was successful. Cleaner assignment begins after payment confirmation.",
    nextStepsHeading: "What happens next",
    nextSteps: [
      {
        title: "Carpet cleaning confirmed",
        body: "Your payment is on file and your floor-care visit is booked.",
      },
      {
        title: "Cleaner assignment",
        body: "Cleaner assignment begins after payment confirmation.",
      },
      {
        title: "Service details",
        body: "Schedule, carpet zones, and stain notes are on your booking page.",
      },
      {
        title: "Drying time",
        body: "Allow drying time after cleaning. good ventilation helps carpets dry faster.",
      },
      {
        title: "Email updates",
        body: "We'll email confirmation and any changes before your scheduled clean.",
      },
    ],
    floorCareNote:
      "Allow drying time after cleaning. Ventilate carpeted areas when possible.",
    ctaLabel: "View carpet cleaning details",
    ctaFootnote: "Opening your carpet cleaning booking…",
  };
}

export type CarpetCustomerPaymentIssueCopy = {
  title: string;
  body: string;
  assignmentNote: string;
  retryGuidance: string;
  slotWarning: string;
};

export function getCarpetCustomerPaymentIssueCopy(
  paymentFailureReason?: PaymentFailureReason,
): CarpetCustomerPaymentIssueCopy {
  const expired = paymentFailureReason === CHECKOUT_EXPIRED_FAILURE_REASON;
  return {
    title: "Your carpet cleaning booking is not confirmed yet",
    body: expired
      ? "Checkout timed out before payment finished. Complete payment to secure your carpet cleaning slot."
      : "Complete payment to secure your carpet cleaning slot.",
    assignmentNote: "Cleaner assignment begins after payment confirmation.",
    retryGuidance:
      "Open your booking and use Retry payment for a fresh secure checkout when available.",
    slotWarning: "This carpet cleaning slot may be released if payment is not completed.",
  };
}

export type CarpetCustomerPaymentVerifyErrorCopy = {
  panelTitle: string;
  intro: string;
  nextSteps: readonly string[];
};

export function getCarpetCustomerPaymentVerifyErrorCopy(): CarpetCustomerPaymentVerifyErrorCopy {
  return {
    panelTitle: "Carpet cleaning payment not confirmed yet",
    intro:
      "We couldn't confirm your payment yet. This can happen if checkout is still processing.",
    nextSteps: [
      "Wait a few seconds, then tap Try again.",
      "Open your bookings to see whether payment already went through.",
      "Contact support if you were charged but your carpet clean still shows unpaid.",
    ],
  };
}

export type CarpetCustomerBookingListCopy = {
  serviceSubtitle: string | null;
  statusBadgeLabel: string | null;
  paymentLine: string | null;
  ctaLabel: string;
};

export function getCarpetCustomerBookingListCopy(input: {
  status: BookingStatus;
  paymentFailureReason: PaymentFailureReason;
  isUpcoming: boolean;
}): CarpetCustomerBookingListCopy {
  const { status, paymentFailureReason, isUpcoming } = input;

  let statusBadgeLabel: string | null = null;
  switch (status) {
    case "pending_payment":
      statusBadgeLabel = "Payment needed";
      break;
    case "confirmed":
      statusBadgeLabel = "Carpet cleaning scheduled";
      break;
    case "pending_assignment":
      statusBadgeLabel = CUSTOMER_FINDING_CLEANER_LABEL;
      break;
    case "assigned":
      statusBadgeLabel = "Cleaner confirmed";
      break;
    case "in_progress":
      statusBadgeLabel = "Floor-care in progress";
      break;
    case "completed":
    case "payout_ready":
    case "paid_out":
      statusBadgeLabel = "Carpet refresh completed";
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
    serviceSubtitle = "Carpet and floor-care service in progress";
  } else if (status === "completed" || status === "payout_ready" || status === "paid_out") {
    serviceSubtitle = "Carpet refresh complete. allow drying time";
  } else if (isUpcoming) {
    serviceSubtitle =
      status === "confirmed" || status === "pending_assignment" || status === "assigned"
        ? "Carpet cleaning scheduled"
        : "Upcoming carpet clean";
  }

  let paymentLine: string | null = null;
  if (status === "payment_failed") {
    paymentLine = "Complete payment to secure your carpet cleaning slot";
  } else if (status === "pending_payment") {
    paymentLine = "Complete checkout to secure your carpet cleaning slot";
  }

  return {
    serviceSubtitle,
    statusBadgeLabel,
    paymentLine,
    ctaLabel: "View carpet details",
  };
}

export type CarpetCustomerBookingDetailCopy = {
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

export function getCarpetCustomerBookingDetailCopy(): CarpetCustomerBookingDetailCopy {
  return {
    shellSubtitle: "Carpet cleaning status, payment, and floor-care details",
    detailsSectionTitle: "Carpet cleaning details",
    activitySectionTitle: "Activity",
    homeSizeLabel: "Carpet zones",
    frequencyLabel: "Visit timing",
    addonsLabel: "Floor-care extras",
    notesLabel: "Areas needing attention",
    cleanerPreferenceLabel: "Cleaner preference",
    assignedCleanerLabel: "Carpet cleaning cleaner",
    serviceHeroTitle: "Carpet Cleaning",
  };
}

export function customerCarpetCompactGuidance(
  status: BookingStatus,
): { primary: string; secondary?: string | null } | null {
  switch (status) {
    case "pending_payment":
      return {
        primary: "Complete secure checkout to confirm your carpet cleaning.",
        secondary: "Cleaner assignment begins after payment confirmation.",
      };
    case "confirmed":
      return {
        primary:
          "We'll match a carpet cleaning cleaner and email you when they're assigned.",
      };
    case "pending_assignment":
      return {
        primary: "We're finding your cleaner for your carpet schedule.",
        secondary: "Status updates appear in Activity below.",
      };
    case "assigned":
      return {
        primary: "Check this page before your visit for stain notes and access updates.",
        secondary: "Allow drying time after cleaning. ventilate when possible.",
      };
    case "in_progress":
      return {
        primary: "Your carpet refresh is in progress.",
        secondary: "Ventilate carpeted areas to help drying.",
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        primary: "Carpet refresh complete. thank you.",
        secondary: "Allow carpets to dry fully before heavy furniture replacement.",
      };
    default:
      return null;
  }
}

export function parseCarpetPaymentReturnServiceSlug(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed && isCarpetCleaningSlug(trimmed) ? trimmed : null;
}
