import {
  normalizePaymentFailureReasonParam,
  PAYMENT_FAILED_ASSIGNMENT_NOTE,
  PAYMENT_FAILED_RETRY_GUIDANCE,
  PAYMENT_FAILED_SUPPORT_NOTE,
  PAYMENT_NOT_CHARGED_REASSURANCE,
  paymentIssuePanelCopy,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import {
  getAirbnbCustomerPaymentIssueCopy,
  isAirbnbCleaningSlug,
  parsePaymentReturnServiceSlug,
} from "@/features/dashboards/airbnbCustomerDisplay";
import { customerBookingDetailPath } from "./paymentReturn";

const BOOKING_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PaymentFailedSearchParams = {
  reason?: string;
  bookingId?: string;
  booking?: string;
  reference?: string;
  service?: string;
};

export type PaymentFailedPageModel = {
  copy: ReturnType<typeof paymentIssuePanelCopy>;
  reassurance: string;
  paymentFailureReason: PaymentFailureReason;
  assignmentNote: string;
  retryGuidance: string;
  supportNote: string;
  bookingId: string | null;
  bookingReferenceLabel: string | null;
  bookingDetailHref: string | null;
};

/** Accepts only UUID-shaped booking identifiers from query params (no DB lookup). */
export function parseSafeBookingIdFromSearchParams(
  params: PaymentFailedSearchParams,
): string | null {
  for (const raw of [params.bookingId, params.booking]) {
    const id = raw?.trim();
    if (id && BOOKING_ID_UUID.test(id)) return id;
  }
  const reference = params.reference?.trim();
  if (reference && BOOKING_ID_UUID.test(reference)) return reference;
  return null;
}

export function formatBookingReferenceLabel(bookingId: string): string {
  return bookingId.slice(0, 8).toUpperCase();
}

export function buildPaymentFailedPageModel(
  params: PaymentFailedSearchParams,
): PaymentFailedPageModel {
  const paymentFailureReason = normalizePaymentFailureReasonParam(params.reason);
  const bookingId = parseSafeBookingIdFromSearchParams(params);
  const serviceSlug = parsePaymentReturnServiceSlug(params.service);
  const airbnb = isAirbnbCleaningSlug(serviceSlug);
  const airbnbCopy = airbnb
    ? getAirbnbCustomerPaymentIssueCopy(paymentFailureReason)
    : null;
  const genericCopy = paymentIssuePanelCopy(paymentFailureReason);

  return {
    copy: airbnbCopy ?? genericCopy,
    reassurance: PAYMENT_NOT_CHARGED_REASSURANCE,
    paymentFailureReason,
    assignmentNote: airbnbCopy?.assignmentNote ?? PAYMENT_FAILED_ASSIGNMENT_NOTE,
    retryGuidance: airbnbCopy?.retryGuidance ?? PAYMENT_FAILED_RETRY_GUIDANCE,
    supportNote:
      airbnb && airbnbCopy
        ? `${PAYMENT_NOT_CHARGED_REASSURANCE} ${airbnbCopy.slotWarning}`
        : PAYMENT_FAILED_SUPPORT_NOTE,
    bookingId,
    bookingReferenceLabel: bookingId ? formatBookingReferenceLabel(bookingId) : null,
    bookingDetailHref: bookingId ? customerBookingDetailPath(bookingId) : null,
  };
}
