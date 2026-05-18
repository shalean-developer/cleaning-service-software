import type { PaymentStatus } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  labelForCustomerBookingStatus,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import {
  labelForPaymentStatus,
  toneForBookingStatus,
  type StatusBadgeTone,
} from "@/features/bookings/server/statusLabels";
import type { BookingDisplayFields } from "@/features/dashboards/server/parseBookingDisplay";

const PAYMENT_FAILED_LIST_HELPER =
  "Payment incomplete — no cleaner assigned until checkout succeeds." as const;

export type CustomerBookingListCardLayersInput = {
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  paymentFailureReason: PaymentFailureReason;
  display: Pick<BookingDisplayFields, "assignmentCustomerMessage">;
  assignedCleanerLabel: string | null;
};

export type CustomerBookingListCardDominantBadge = {
  label: string;
  tone: StatusBadgeTone;
};

export type CustomerBookingListCardPaymentLine = {
  text: string;
  tone: "muted" | "danger";
};

export type CustomerBookingListCardSupportingMessage =
  | { kind: "assignment"; text: string }
  | { kind: "cleaner"; text: string };

export type CustomerBookingListCardLayers = {
  dominantBadge: CustomerBookingListCardDominantBadge;
  paymentStatusLine: CustomerBookingListCardPaymentLine | null;
  supportingMessage: CustomerBookingListCardSupportingMessage | null;
};

function paymentStatusLineForBooking(
  status: BookingStatus,
  paymentStatus: PaymentStatus | null,
): CustomerBookingListCardPaymentLine | null {
  if (status === "payment_failed") {
    return { text: PAYMENT_FAILED_LIST_HELPER, tone: "danger" };
  }

  if (
    status === "completed" ||
    status === "payout_ready" ||
    status === "paid_out"
  ) {
    return null;
  }

  if (!paymentStatus) return null;

  if (status === "pending_payment") {
    if (paymentStatus === "failed" || paymentStatus === "refunded") {
      return { text: labelForPaymentStatus(paymentStatus), tone: "muted" };
    }
    return null;
  }

  if (status === "confirmed" && paymentStatus === "paid") return null;

  if (
    (status === "assigned" || status === "in_progress") &&
    paymentStatus === "paid"
  ) {
    return null;
  }

  if (status === "pending_assignment" && paymentStatus === "paid") {
    return { text: labelForPaymentStatus(paymentStatus), tone: "muted" };
  }

  if (paymentStatus === "failed" || paymentStatus === "refunded") {
    return { text: labelForPaymentStatus(paymentStatus), tone: "muted" };
  }

  return null;
}

function supportingMessageForBooking(
  input: CustomerBookingListCardLayersInput,
): CustomerBookingListCardSupportingMessage | null {
  if (
    input.status !== "payment_failed" &&
    input.display.assignmentCustomerMessage
  ) {
    return { kind: "assignment", text: input.display.assignmentCustomerMessage };
  }

  if (input.assignedCleanerLabel) {
    return { kind: "cleaner", text: input.assignedCleanerLabel };
  }

  return null;
}

/** Presentation-only hierarchy for customer booking list cards (Stage 7P-1A). */
export function customerBookingListCardLayers(
  input: CustomerBookingListCardLayersInput,
): CustomerBookingListCardLayers {
  return {
    dominantBadge: {
      label: labelForCustomerBookingStatus(input.status, input.paymentFailureReason),
      tone: toneForBookingStatus(input.status),
    },
    paymentStatusLine: paymentStatusLineForBooking(input.status, input.paymentStatus),
    supportingMessage: supportingMessageForBooking(input),
  };
}
