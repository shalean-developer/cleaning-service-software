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

import {
  CUSTOMER_PAYMENT_INCOMPLETE_LIST_HELPER,
  customerBookingPaymentLineClass,
} from "@/lib/app/dashboardEcosystemDisplay";

export { customerBookingPaymentLineClass };

export type CustomerBookingListCardLayersInput = {
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  paymentFailureReason: PaymentFailureReason;
  display: Pick<BookingDisplayFields, "assignmentCustomerMessage">;
  deferredAssignmentMessage?: string | null;
  assignedCleanerLabel: string | null;
};

export type CustomerBookingListCardDominantBadge = {
  label: string;
  tone: StatusBadgeTone;
};

export type CustomerBookingListCardPaymentLine = {
  text: string;
  tone: "muted" | "attention";
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
    return { text: CUSTOMER_PAYMENT_INCOMPLETE_LIST_HELPER, tone: "attention" };
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
  const deferredMessage = input.deferredAssignmentMessage?.trim();
  if (input.status !== "payment_failed" && deferredMessage) {
    return { kind: "assignment", text: deferredMessage };
  }

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
