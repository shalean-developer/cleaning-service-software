import type { PaymentStatus } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  customerAirbnbStatusLine,
  customerAirbnbTimingHint,
  isAirbnbCleaningSlug,
} from "@/features/booking-wizard/airbnbCleaningDisplay";
import { customerAirbnbCompactGuidance } from "@/features/dashboards/airbnbCustomerDisplay";
import {
  labelForCustomerBookingStatus,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";
import { toneForBookingStatus } from "@/features/bookings/server/statusLabels";

import {
  UI_CARD_SHELL_CLASS,
  UI_DETAILS_DISCLOSURE_CLASS,
  UI_DETAILS_SUMMARY_CLASS,
} from "@/lib/ui/productUiTokens";

/** Shared card shell for customer booking detail sections (presentation only). */
export const CUSTOMER_BOOKING_DETAIL_CARD_CLASS = UI_CARD_SHELL_CLASS;

export const CUSTOMER_BOOKING_DETAIL_DISCLOSURE_CLASS = UI_DETAILS_DISCLOSURE_CLASS;

export const CUSTOMER_BOOKING_DETAIL_DISCLOSURE_SUMMARY_CLASS = UI_DETAILS_SUMMARY_CLASS;

export type CustomerBookingStatusHeroPresentation = {
  statusLabel: string;
  /** One short status line; empty when payment panel owns the narrative. */
  statusLine: string;
  /** Optional timing hint (e.g. deferred dispatch window). */
  timingHint: string | null;
  tone: StatusBadgeTone;
  surfaceClass: string;
  ringClass: string;
  showStatusNarrative: boolean;
};

const HERO_SURFACE_BY_TONE: Record<StatusBadgeTone, { surface: string; ring: string }> = {
  neutral: {
    surface: "bg-zinc-50/90",
    ring: "ring-zinc-200/70",
  },
  info: {
    surface: "bg-sky-50/80",
    ring: "ring-sky-200/60",
  },
  success: {
    surface: "bg-emerald-50/80",
    ring: "ring-emerald-200/60",
  },
  warning: {
    surface: "bg-amber-50/80",
    ring: "ring-amber-200/60",
  },
  danger: {
    surface: "bg-red-50/80",
    ring: "ring-red-200/60",
  },
};

function heroNarrativeForStatus(
  status: BookingStatus,
  paymentFailureReason: PaymentFailureReason,
): Pick<CustomerBookingStatusHeroPresentation, "statusLine" | "timingHint" | "showStatusNarrative"> {
  if (status === "payment_failed") {
    return { statusLine: "", timingHint: null, showStatusNarrative: false };
  }

  switch (status) {
    case "pending_payment":
      return {
        statusLine: "Complete checkout to confirm your slot.",
        timingHint: "As soon as payment is received",
        showStatusNarrative: true,
      };
    case "confirmed":
      return {
        statusLine: "Matching a cleaner to your booking.",
        timingHint: "Usually within a few minutes",
        showStatusNarrative: true,
      };
    case "pending_assignment":
      return {
        statusLine: "Finding a cleaner for your schedule.",
        timingHint: "Within 15–60 minutes",
        showStatusNarrative: true,
      };
    case "assigned":
      return {
        statusLine: "Your cleaner is confirmed.",
        timingHint: "Before your scheduled clean",
        showStatusNarrative: true,
      };
    case "in_progress":
      return {
        statusLine: "Your clean is in progress.",
        timingHint: "During your scheduled window",
        showStatusNarrative: true,
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        statusLine: "Booking complete. Thank you for choosing us.",
        timingHint: null,
        showStatusNarrative: true,
      };
    case "cancelled":
      return {
        statusLine: "This booking was cancelled.",
        timingHint: null,
        showStatusNarrative: true,
      };
    default:
      return {
        statusLine: "We'll update this page as your booking progresses.",
        timingHint: null,
        showStatusNarrative: true,
      };
  }
}

/** Status hero copy and tint derived from existing booking status (visual mapping only). */
export function customerBookingStatusHero(
  status: BookingStatus,
  paymentFailureReason: PaymentFailureReason,
  options?: {
    deferredAssignmentMessage?: string | null;
    serviceSlug?: string | null;
  },
): CustomerBookingStatusHeroPresentation {
  const tone =
    status === "payment_failed" ? "warning" : toneForBookingStatus(status);
  const surfaces = HERO_SURFACE_BY_TONE[tone];
  const narrative = heroNarrativeForStatus(status, paymentFailureReason);
  const deferredMessage = options?.deferredAssignmentMessage?.trim();
  const airbnb = isAirbnbCleaningSlug(options?.serviceSlug);

  return {
    statusLabel: labelForCustomerBookingStatus(status, paymentFailureReason),
    statusLine:
      deferredMessage ??
      (airbnb
        ? customerAirbnbStatusLine(status, narrative.statusLine)
        : narrative.statusLine),
    timingHint: deferredMessage
      ? "Closer to your service date"
      : airbnb
        ? customerAirbnbTimingHint(status, narrative.timingHint)
        : narrative.timingHint,
    tone,
    surfaceClass: surfaces.surface,
    ringClass: surfaces.ring,
    showStatusNarrative: narrative.showStatusNarrative || Boolean(deferredMessage),
  };
}

export type CustomerBookingNextStep = {
  title: string;
  body: string;
};

/** Compact, status-aware guidance (1–2 lines + optional collapsible detail). */
export type CustomerBookingCompactGuidance = {
  primary: string;
  secondary?: string | null;
  detailSteps?: readonly CustomerBookingNextStep[];
};

const EMAIL_UPDATES_STEP: CustomerBookingNextStep = {
  title: "Email updates",
  body: "We'll email you confirmation and any changes to your booking.",
};

/** Returns null when hero or payment panel already owns the explanation. */
export function customerBookingCompactGuidance(
  status: BookingStatus,
  options?: {
    deferredAssignmentMessage?: string | null;
    serviceSlug?: string | null;
  },
): CustomerBookingCompactGuidance | null {
  if (status === "payment_failed" || status === "cancelled") return null;
  if (
    options?.deferredAssignmentMessage?.trim() &&
    (status === "confirmed" ||
      status === "pending_assignment" ||
      status === "assigned")
  ) {
    return null;
  }

  if (isAirbnbCleaningSlug(options?.serviceSlug)) {
    return customerAirbnbCompactGuidance(status);
  }

  switch (status) {
    case "pending_payment":
      return {
        primary: "Pay via secure checkout to confirm your booking.",
        secondary: "We assign a cleaner after payment succeeds.",
      };
    case "confirmed":
      return {
        primary: "We'll match a cleaner and email you when assigned.",
        detailSteps: [EMAIL_UPDATES_STEP],
      };
    case "pending_assignment":
      return {
        primary: "We're matching a cleaner to your schedule and preferences.",
        secondary: "Status updates appear in Activity below.",
        detailSteps: [EMAIL_UPDATES_STEP],
      };
    case "assigned":
      return {
        primary: "Check this page on the day of your clean for any changes.",
        detailSteps: [EMAIL_UPDATES_STEP],
      };
    case "in_progress":
      return {
        primary: "We'll mark milestones in Activity as your clean progresses.",
        detailSteps: [EMAIL_UPDATES_STEP],
      };
    default:
      return null;
  }
}

/** @deprecated Use {@link customerBookingCompactGuidance}; kept for tests migrating from 4-step panels. */
export type CustomerBookingWhatHappensNextPresentation = CustomerBookingCompactGuidance & {
  title: string;
  steps: readonly CustomerBookingNextStep[];
};

/** @deprecated Use {@link customerBookingCompactGuidance}. */
export function customerBookingWhatHappensNext(
  status: BookingStatus,
  options?: { deferredAssignmentMessage?: string | null },
): CustomerBookingWhatHappensNextPresentation | null {
  const compact = customerBookingCompactGuidance(status, options);
  if (!compact) return null;
  const steps = compact.detailSteps ?? [];
  if (steps.length === 0 && !compact.secondary) return null;
  return {
    ...compact,
    title: "More about your booking",
    steps: compact.secondary
      ? [{ title: "Next", body: compact.secondary }, ...steps]
      : steps,
  };
}

/** Avoid repeating assignment callouts already shown in the hero. */
export function shouldSuppressAssignmentCalloutInDetails(input: {
  deferredAssignmentMessage?: string | null;
  assignmentCustomerMessage?: string | null;
}): boolean {
  const deferred = input.deferredAssignmentMessage?.trim();
  if (deferred) return true;
  const assignment = input.assignmentCustomerMessage?.trim();
  if (!assignment) return false;
  return false;
}

export function customerBookingAmountLabel(
  status: BookingStatus,
  paymentStatus: PaymentStatus | null,
): "Amount paid" | "Amount due" | "Booking total" {
  if (status === "pending_payment" || status === "payment_failed") {
    return "Amount due";
  }
  if (paymentStatus === "paid") {
    return "Amount paid";
  }
  return "Booking total";
}

export function shouldShowPaymentStatusChip(
  status: BookingStatus,
  paymentStatus: PaymentStatus | null,
): boolean {
  if (status === "payment_failed" || !paymentStatus) return false;
  if (paymentStatus !== "paid") return true;
  return (
    status !== "confirmed" &&
    status !== "assigned" &&
    status !== "in_progress" &&
    status !== "completed" &&
    status !== "payout_ready" &&
    status !== "paid_out"
  );
}
