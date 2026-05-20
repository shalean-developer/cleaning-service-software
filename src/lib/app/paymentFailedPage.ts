import {
  normalizePaymentFailureReasonParam,
  PAYMENT_FAILED_ASSIGNMENT_NOTE,
  PAYMENT_FAILED_RETRY_GUIDANCE,
  PAYMENT_NOT_CHARGED_REASSURANCE,
  paymentIssuePanelCopy,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import { PAYMENT_FAILED_PAGE_FOOTER_HINT } from "@/features/bookings/server/paymentFailurePresentation";
import {
  getAirbnbCustomerPaymentIssueCopy,
  isAirbnbCleaningSlug,
} from "@/features/dashboards/airbnbCustomerDisplay";
import { parsePaymentReturnServiceSlug } from "@/features/dashboards/customerDisplayServiceSlug";
import { isDeepCleaningSlug } from "@/features/booking-wizard/deepCleaningDisplay";
import { isCarpetCleaningSlug } from "@/features/booking-wizard/carpetCleaningDisplay";
import { isMovingCleaningSlug } from "@/features/booking-wizard/movingCleaningDisplay";
import { isOfficeCleaningSlug } from "@/features/booking-wizard/officeCleaningDisplay";
import { getDeepCustomerPaymentIssueCopy } from "@/features/dashboards/deepCustomerDisplay";
import { getCarpetCustomerPaymentIssueCopy } from "@/features/dashboards/carpetCustomerDisplay";
import { getMovingCustomerPaymentIssueCopy } from "@/features/dashboards/movingCustomerDisplay";
import { getOfficeCustomerPaymentIssueCopy } from "@/features/dashboards/officeCustomerDisplay";
import {
  getRegularCustomerPaymentIssueCopy,
  isRegularCleaningSlug,
} from "@/features/dashboards/regularCustomerDisplay";
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
  const office = isOfficeCleaningSlug(serviceSlug);
  const moving = isMovingCleaningSlug(serviceSlug);
  const deep = isDeepCleaningSlug(serviceSlug);
  const carpet = isCarpetCleaningSlug(serviceSlug);
  const regular = isRegularCleaningSlug(serviceSlug);
  const airbnbCopy = airbnb
    ? getAirbnbCustomerPaymentIssueCopy(paymentFailureReason)
    : null;
  const officeCopy = office
    ? getOfficeCustomerPaymentIssueCopy(paymentFailureReason)
    : null;
  const movingCopy = moving
    ? getMovingCustomerPaymentIssueCopy(paymentFailureReason)
    : null;
  const deepCopy = deep ? getDeepCustomerPaymentIssueCopy(paymentFailureReason) : null;
  const carpetCopy = carpet ? getCarpetCustomerPaymentIssueCopy(paymentFailureReason) : null;
  const regularCopy = regular
    ? getRegularCustomerPaymentIssueCopy(paymentFailureReason)
    : null;
  const serviceCopy =
    airbnbCopy ?? officeCopy ?? movingCopy ?? deepCopy ?? carpetCopy ?? regularCopy;
  const genericCopy = paymentIssuePanelCopy(paymentFailureReason);

  return {
    copy: serviceCopy ?? genericCopy,
    reassurance: PAYMENT_NOT_CHARGED_REASSURANCE,
    paymentFailureReason,
    assignmentNote: serviceCopy?.assignmentNote ?? PAYMENT_FAILED_ASSIGNMENT_NOTE,
    retryGuidance: serviceCopy?.retryGuidance ?? PAYMENT_FAILED_RETRY_GUIDANCE,
    supportNote: serviceCopy?.slotWarning?.trim()
      ? serviceCopy.slotWarning.trim()
      : PAYMENT_FAILED_PAGE_FOOTER_HINT,
    bookingId,
    bookingReferenceLabel: bookingId ? formatBookingReferenceLabel(bookingId) : null,
    bookingDetailHref: bookingId ? customerBookingDetailPath(bookingId) : null,
  };
}
