import type { PaymentStatus } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  labelForCustomerBookingStatus,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";
import { toneForBookingStatus } from "@/features/bookings/server/statusLabels";

/** Shared card shell for customer booking detail sections (presentation only). */
export const CUSTOMER_BOOKING_DETAIL_CARD_CLASS =
  "rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

export const CUSTOMER_BOOKING_DETAIL_INSET_CLASS =
  "rounded-xl border border-zinc-200 bg-zinc-50/80";

export type CustomerBookingStatusHeroPresentation = {
  statusLabel: string;
  description: string;
  expectedUpdate: string | null;
  tone: StatusBadgeTone;
  surfaceClass: string;
  ringClass: string;
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

function heroCopyForStatus(
  status: BookingStatus,
  paymentFailureReason: PaymentFailureReason,
): Pick<CustomerBookingStatusHeroPresentation, "description" | "expectedUpdate"> {
  switch (status) {
    case "pending_payment":
      return {
        description: "Complete checkout to confirm your booking and secure your time slot.",
        expectedUpdate: "As soon as payment is received",
      };
    case "confirmed":
      return {
        description: "Payment is confirmed. We're matching a cleaner to your booking.",
        expectedUpdate: "Usually within a few minutes",
      };
    case "pending_assignment":
      return {
        description: "We're finding the best available cleaner for your schedule.",
        expectedUpdate: "Within 15–60 minutes",
      };
    case "assigned":
      return {
        description: "Your cleaner is confirmed. Details will appear here when available.",
        expectedUpdate: "Before your scheduled clean",
      };
    case "in_progress":
      return {
        description: "Your clean is in progress. This page updates as milestones complete.",
        expectedUpdate: "During your scheduled window",
      };
    case "completed":
    case "payout_ready":
    case "paid_out":
      return {
        description: "This booking is complete. Thank you for choosing us.",
        expectedUpdate: null,
      };
    case "payment_failed":
      if (paymentFailureReason === "checkout_expired") {
        return {
          description: "Your checkout session expired before payment was completed.",
          expectedUpdate: "Retry payment when available",
        };
      }
      return {
        description: "Payment has not been confirmed for this booking yet.",
        expectedUpdate: "Retry payment when available",
      };
    case "cancelled":
      return {
        description: "This booking was cancelled and is no longer active.",
        expectedUpdate: null,
      };
    default:
      return {
        description: "We're tracking your booking and will update this page as things progress.",
        expectedUpdate: null,
      };
  }
}

/** Status hero copy and tint derived from existing booking status (visual mapping only). */
export function customerBookingStatusHero(
  status: BookingStatus,
  paymentFailureReason: PaymentFailureReason,
): CustomerBookingStatusHeroPresentation {
  const tone = toneForBookingStatus(status);
  const surfaces = HERO_SURFACE_BY_TONE[tone];
  const copy = heroCopyForStatus(status, paymentFailureReason);

  return {
    statusLabel: labelForCustomerBookingStatus(status, paymentFailureReason),
    description: copy.description,
    expectedUpdate: copy.expectedUpdate,
    tone,
    surfaceClass: surfaces.surface,
    ringClass: surfaces.ring,
  };
}

export type CustomerBookingNextStep = {
  title: string;
  body: string;
};

export type CustomerBookingWhatHappensNextPresentation = {
  title: string;
  steps: readonly CustomerBookingNextStep[];
};

const EMAIL_UPDATES_STEP: CustomerBookingNextStep = {
  title: "Email updates",
  body: "We'll email you confirmation and any changes to your booking.",
};

/** Static reassurance steps keyed by booking status (informational UI only). */
export function customerBookingWhatHappensNext(
  status: BookingStatus,
): CustomerBookingWhatHappensNextPresentation | null {
  switch (status) {
    case "pending_payment":
      return {
        title: "What happens next",
        steps: [
          {
            title: "Secure checkout",
            body: "Complete payment on Paystack to confirm your booking.",
          },
          {
            title: "Payment confirmed",
            body: "We record your booking as soon as payment succeeds.",
          },
          {
            title: "Cleaner assignment",
            body: "We match an eligible cleaner to your schedule.",
          },
          EMAIL_UPDATES_STEP,
        ],
      };
    case "confirmed":
      return {
        title: "What happens next",
        steps: [
          {
            title: "Payment confirmed",
            body: "Your payment is on file and your booking is active.",
          },
          {
            title: "Cleaner assignment",
            body: "We're notifying available cleaners in your area.",
          },
          {
            title: "Updates on this page",
            body: "You'll see assignment progress and details here.",
          },
          EMAIL_UPDATES_STEP,
        ],
      };
    case "pending_assignment":
      return {
        title: "What happens next",
        steps: [
          {
            title: "Payment confirmed",
            body: "Your booking is paid and ready for assignment.",
          },
          {
            title: "Cleaner assignment",
            body: "We're matching a cleaner to your schedule and preferences.",
          },
          {
            title: "Updates on this page",
            body: "Status changes appear in your timeline below.",
          },
          EMAIL_UPDATES_STEP,
        ],
      };
    case "assigned":
      return {
        title: "What happens next",
        steps: [
          {
            title: "Cleaner confirmed",
            body: "Your cleaner is assigned for this booking.",
          },
          {
            title: "Updates on this page",
            body: "Check here on the day of your clean for any changes.",
          },
          {
            title: "Scheduled service",
            body: "Cleaning starts at your booked date and time.",
          },
          EMAIL_UPDATES_STEP,
        ],
      };
    case "in_progress":
      return {
        title: "What happens next",
        steps: [
          {
            title: "Clean in progress",
            body: "Your cleaner is working during your scheduled window.",
          },
          {
            title: "Updates on this page",
            body: "We'll mark milestones in your timeline as they complete.",
          },
          {
            title: "Completion",
            body: "You'll see the final status here when the clean is done.",
          },
          EMAIL_UPDATES_STEP,
        ],
      };
    default:
      return null;
  }
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
  return status !== "payment_failed" && paymentStatus !== null;
}
