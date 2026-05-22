/**
 * Office Cleaning customer-facing copy (payment return, bookings list, detail).
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
  customerOfficeStatusLine,
  customerOfficeTimingHint,
  isOfficeCleaningSlug,
  OFFICE_CLEANING_SLUG,
} from "@/features/booking-wizard/officeCleaningDisplay";

export {
  isOfficeCleaningSlug,
  isOfficeCleaningSlug as isOfficeCleaningService,
  OFFICE_CLEANING_SLUG,
  customerOfficeStatusLine,
  customerOfficeTimingHint,
};

export type OfficeCustomerSuccessCopy = {
  title: string;
  lead: string;
  nextStepsHeading: string;
  nextSteps: readonly { title: string; body: string }[];
  workspaceNote: string;
  ctaLabel: string;
  ctaFootnote: string;
};

export function getOfficeCustomerSuccessCopy(
  variant: PaymentSuccessVariant,
): OfficeCustomerSuccessCopy {
  const already = variant === "already_confirmed";
  return {
    title: already ? "Office clean payment already confirmed" : "Your office cleaning is scheduled",
    lead: already
      ? "Your payment is on file. Opening your workspace cleaning booking now."
      : "Your payment was successful. Cleaner assignment begins after payment confirmation.",
    nextStepsHeading: "What happens next",
    nextSteps: [
      {
        title: "Workspace cleaning scheduled",
        body: "Your payment is on file and your office clean is booked.",
      },
      {
        title: "Cleaner assignment",
        body: "Cleaner assignment begins after payment confirmation.",
      },
      {
        title: "Workspace details",
        body: "Schedule, access, and workspace instructions are on your booking page.",
      },
      {
        title: "Email updates",
        body: "We'll email confirmation and any changes before your scheduled service.",
      },
    ],
    workspaceNote: "We'll help maintain a clean and productive workspace.",
    ctaLabel: "View workspace cleaning details",
    ctaFootnote: "Opening your office cleaning booking…",
  };
}

export type OfficeCustomerPaymentIssueCopy = {
  title: string;
  body: string;
  assignmentNote: string;
  retryGuidance: string;
  slotWarning: string;
};

export function getOfficeCustomerPaymentIssueCopy(
  paymentFailureReason?: PaymentFailureReason,
): OfficeCustomerPaymentIssueCopy {
  const expired = paymentFailureReason === CHECKOUT_EXPIRED_FAILURE_REASON;
  return {
    title: "Your office cleaning booking is not confirmed yet",
    body: expired
      ? "Checkout timed out before payment finished. Complete payment to secure your workspace cleaning slot."
      : "Complete payment to secure your workspace cleaning slot.",
    assignmentNote: "Cleaner assignment begins after payment confirmation.",
    retryGuidance:
      "Open your booking and use Retry payment for a fresh secure checkout when available.",
    slotWarning: "This workspace service slot may be released if payment is not completed.",
  };
}

export type OfficeCustomerPaymentVerifyErrorCopy = {
  panelTitle: string;
  intro: string;
  nextSteps: readonly string[];
};

export function getOfficeCustomerPaymentVerifyErrorCopy(): OfficeCustomerPaymentVerifyErrorCopy {
  return {
    panelTitle: "Office clean payment not confirmed yet",
    intro:
      "We couldn't confirm your payment yet. This can happen if checkout is still processing.",
    nextSteps: [
      "Wait a few seconds, then tap Try again.",
      "Open your bookings to see whether payment already went through.",
      "Contact support if you were charged but your office clean still shows unpaid.",
    ],
  };
}

export type OfficeCustomerBookingListCopy = {
  serviceSubtitle: string | null;
  statusBadgeLabel: string | null;
  paymentLine: string | null;
  ctaLabel: string;
};

export function getOfficeCustomerBookingListCopy(input: {
  status: BookingStatus;
  paymentFailureReason: PaymentFailureReason;
  isUpcoming: boolean;
}): OfficeCustomerBookingListCopy {
  const { status, paymentFailureReason, isUpcoming } = input;

  let statusBadgeLabel: string | null = null;
  switch (status) {
    case "pending_payment":
      statusBadgeLabel = "Payment needed";
      break;
    case "confirmed":
      statusBadgeLabel = "Workspace cleaning scheduled";
      break;
    case "pending_assignment":
      statusBadgeLabel = CUSTOMER_FINDING_CLEANER_LABEL;
      break;
    case "assigned":
      statusBadgeLabel = "Cleaner confirmed";
      break;
    case "in_progress":
      statusBadgeLabel = "Commercial cleaning";
      break;
    case "completed":
    case "payout_ready":
    case "paid_out":
      statusBadgeLabel = "Workspace refresh completed";
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
    serviceSubtitle = "Maintaining professional workspace standards";
  } else if (status === "completed" || status === "payout_ready" || status === "paid_out") {
    serviceSubtitle = "Workspace refresh complete";
  } else if (isUpcoming) {
    serviceSubtitle =
      status === "confirmed" || status === "pending_assignment" || status === "assigned"
        ? "Recurring office maintenance scheduled"
        : "Upcoming workspace clean";
  }

  let paymentLine: string | null = null;
  if (status === "payment_failed") {
    paymentLine = "Complete payment to secure your workspace cleaning slot";
  } else if (status === "pending_payment") {
    paymentLine = "Complete checkout to secure your workspace cleaning slot";
  }

  return {
    serviceSubtitle,
    statusBadgeLabel,
    paymentLine,
    ctaLabel: "View workspace details",
  };
}

export type OfficeCustomerBookingDetailCopy = {
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

export function getOfficeCustomerBookingDetailCopy(): OfficeCustomerBookingDetailCopy {
  return {
    shellSubtitle: "Workspace cleaning status, payment, and commercial details",
    detailsSectionTitle: "Workspace details",
    activitySectionTitle: "Activity",
    homeSizeLabel: "Workspace size",
    frequencyLabel: "Service cadence",
    addonsLabel: "Commercial cleaning extras",
    notesLabel: "Workspace instructions",
    cleanerPreferenceLabel: "Cleaner preference",
    assignedCleanerLabel: "Office cleaning professional",
    serviceHeroTitle: "Office Cleaning",
  };
}

export function customerOfficeCompactGuidance(
  status: BookingStatus,
): { primary: string; secondary?: string | null } | null {
  switch (status) {
    case "pending_payment":
      return {
        primary: "Complete secure checkout to confirm your workspace cleaning.",
        secondary: "Cleaner assignment begins after payment confirmation.",
      };
    case "confirmed":
      return {
        primary:
          "We'll match an office cleaning professional and email you when they're assigned.",
      };
    case "pending_assignment":
      return {
        primary: "We're finding your cleaner for your workspace schedule.",
        secondary: "Status updates appear in Activity below.",
      };
    case "assigned":
      return {
        primary: "Check this page on service day for any last-minute updates.",
      };
    case "in_progress":
      return {
        primary: "Your workspace is being cleaned to professional standards.",
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        primary: "Workspace refresh complete. thank you.",
      };
    default:
      return null;
  }
}

/** Parses optional `service` query param from payment return URLs. */
export function parseOfficePaymentReturnServiceSlug(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed && isOfficeCleaningSlug(trimmed) ? trimmed : null;
}

/** Bundled customer dashboard copy for tests. */
export function getOfficeCustomerCopy(): {
  success: typeof getOfficeCustomerSuccessCopy;
  list: typeof getOfficeCustomerBookingListCopy;
  detail: typeof getOfficeCustomerBookingDetailCopy;
  compactGuidance: typeof customerOfficeCompactGuidance;
} {
  return {
    success: getOfficeCustomerSuccessCopy,
    list: getOfficeCustomerBookingListCopy,
    detail: getOfficeCustomerBookingDetailCopy,
    compactGuidance: customerOfficeCompactGuidance,
  };
}
