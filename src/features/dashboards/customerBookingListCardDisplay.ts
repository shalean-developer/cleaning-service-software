import type { PaymentStatus } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  labelForCustomerBookingStatus,
  labelForCustomerPaymentStatus,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import {
  getAirbnbCustomerBookingListCopy,
  isAirbnbCleaningSlug,
} from "@/features/dashboards/airbnbCustomerDisplay";
import { isDeepCleaningSlug } from "@/features/booking-wizard/deepCleaningDisplay";
import { isCarpetCleaningSlug } from "@/features/booking-wizard/carpetCleaningDisplay";
import { isMovingCleaningSlug } from "@/features/booking-wizard/movingCleaningDisplay";
import { getCarpetCustomerBookingListCopy } from "@/features/dashboards/carpetCustomerDisplay";
import { getDeepCustomerBookingListCopy } from "@/features/dashboards/deepCustomerDisplay";
import { getMovingCustomerBookingListCopy } from "@/features/dashboards/movingCustomerDisplay";
import { isOfficeCleaningSlug } from "@/features/booking-wizard/officeCleaningDisplay";
import { getOfficeCustomerBookingListCopy } from "@/features/dashboards/officeCustomerDisplay";
import {
  getRegularCustomerBookingListCopy,
  isRegularCleaningSlug,
} from "@/features/dashboards/regularCustomerDisplay";
import { toneForBookingStatus, type StatusBadgeTone } from "@/features/bookings/server/statusLabels";
import type { BookingDisplayFields } from "@/features/dashboards/server/parseBookingDisplay";

import { customerBookingPaymentLineClass } from "@/lib/app/dashboardEcosystemDisplay";

export { customerBookingPaymentLineClass };

export type CustomerBookingListCardLayersInput = {
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  paymentFailureReason: PaymentFailureReason;
  isUpcoming: boolean;
  display: Pick<
    BookingDisplayFields,
    | "assignmentCustomerMessage"
    | "isTwoCleanerRequest"
    | "teamSupportLabel"
    | "serviceSlug"
  >;
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
  serviceSubtitle: string | null;
  paymentStatusLine: CustomerBookingListCardPaymentLine | null;
  supportingMessage: CustomerBookingListCardSupportingMessage | null;
  ctaLabel: string;
};

function paymentStatusLineForBooking(
  status: BookingStatus,
  paymentStatus: PaymentStatus | null,
): CustomerBookingListCardPaymentLine | null {
  if (status === "payment_failed") {
    return null;
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
      return { text: labelForCustomerPaymentStatus(paymentStatus), tone: "muted" };
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

  if (paymentStatus === "failed" || paymentStatus === "refunded") {
    return { text: labelForCustomerPaymentStatus(paymentStatus), tone: "muted" };
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
    input.status !== "pending_assignment" &&
    input.status !== "confirmed" &&
    input.display.assignmentCustomerMessage
  ) {
    return { kind: "assignment", text: input.display.assignmentCustomerMessage };
  }

  if (
    input.status !== "payment_failed" &&
    input.display.isTwoCleanerRequest &&
    input.display.teamSupportLabel
  ) {
    return { kind: "assignment", text: input.display.teamSupportLabel };
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
  const airbnb = isAirbnbCleaningSlug(input.display.serviceSlug);
  const office = isOfficeCleaningSlug(input.display.serviceSlug);
  const moving = isMovingCleaningSlug(input.display.serviceSlug);
  const deep = isDeepCleaningSlug(input.display.serviceSlug);
  const carpet = isCarpetCleaningSlug(input.display.serviceSlug);
  const regular = isRegularCleaningSlug(input.display.serviceSlug);
  const airbnbCopy = airbnb
    ? getAirbnbCustomerBookingListCopy({
        status: input.status,
        paymentFailureReason: input.paymentFailureReason,
        isUpcoming: input.isUpcoming,
      })
    : null;
  const officeCopy = office
    ? getOfficeCustomerBookingListCopy({
        status: input.status,
        paymentFailureReason: input.paymentFailureReason,
        isUpcoming: input.isUpcoming,
      })
    : null;
  const movingCopy = moving
    ? getMovingCustomerBookingListCopy({
        status: input.status,
        paymentFailureReason: input.paymentFailureReason,
        isUpcoming: input.isUpcoming,
      })
    : null;
  const deepCopy = deep
    ? getDeepCustomerBookingListCopy({
        status: input.status,
        paymentFailureReason: input.paymentFailureReason,
        isUpcoming: input.isUpcoming,
      })
    : null;
  const carpetCopy = carpet
    ? getCarpetCustomerBookingListCopy({
        status: input.status,
        paymentFailureReason: input.paymentFailureReason,
        isUpcoming: input.isUpcoming,
      })
    : null;
  const regularCopy = regular
    ? getRegularCustomerBookingListCopy({
        status: input.status,
        paymentFailureReason: input.paymentFailureReason,
        isUpcoming: input.isUpcoming,
      })
    : null;
  const serviceCopy =
    airbnbCopy ?? officeCopy ?? movingCopy ?? deepCopy ?? carpetCopy ?? regularCopy;

  const defaultPaymentLine = paymentStatusLineForBooking(input.status, input.paymentStatus);
  const paymentStatusLine =
    serviceCopy?.paymentLine != null
      ? { text: serviceCopy.paymentLine, tone: "attention" as const }
      : defaultPaymentLine;

  return {
    dominantBadge: {
      label:
        serviceCopy?.statusBadgeLabel ??
        labelForCustomerBookingStatus(input.status, input.paymentFailureReason),
      tone: toneForBookingStatus(input.status),
    },
    serviceSubtitle: serviceCopy?.serviceSubtitle ?? null,
    paymentStatusLine,
    supportingMessage: supportingMessageForBooking(input),
    ctaLabel:
      input.status === "payment_failed"
        ? "Complete payment"
        : serviceCopy?.ctaLabel ?? "View details",
  };
}
