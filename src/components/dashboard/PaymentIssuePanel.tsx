import Link from "next/link";
import type { PaymentFailureReason } from "@/features/bookings/server/paymentFailureDisplay";
import {
  PAYMENT_FAILED_ASSIGNMENT_NOTE,
  paymentIssuePanelCopy,
  paymentIssuePanelReassurance,
} from "@/features/bookings/server/paymentFailureDisplay";
import { paymentIssueDetailSteps } from "@/features/bookings/server/paymentFailurePresentation";
import {
  getAirbnbCustomerPaymentIssueCopy,
  isAirbnbCleaningSlug,
} from "@/features/dashboards/airbnbCustomerDisplay";
import { isCarpetCleaningSlug } from "@/features/booking-wizard/carpetCleaningDisplay";
import { isDeepCleaningSlug } from "@/features/booking-wizard/deepCleaningDisplay";
import { isMovingCleaningSlug } from "@/features/booking-wizard/movingCleaningDisplay";
import { isOfficeCleaningSlug } from "@/features/booking-wizard/officeCleaningDisplay";
import { getCarpetCustomerPaymentIssueCopy } from "@/features/dashboards/carpetCustomerDisplay";
import { getDeepCustomerPaymentIssueCopy } from "@/features/dashboards/deepCustomerDisplay";
import { getMovingCustomerPaymentIssueCopy } from "@/features/dashboards/movingCustomerDisplay";
import { getOfficeCustomerPaymentIssueCopy } from "@/features/dashboards/officeCustomerDisplay";
import {
  getRegularCustomerPaymentIssueCopy,
  isRegularCleaningSlug,
} from "@/features/dashboards/regularCustomerDisplay";
import { UI_LINK_SECONDARY_ACTION_CLASS } from "@/lib/ui/productUiTokens";
import { RetryPaymentButton } from "./RetryPaymentButton";

type PaymentIssuePanelProps = {
  bookingId: string;
  customerEmail: string;
  serviceSlug?: string | null;
  paymentFailureReason?: PaymentFailureReason;
  canRetryPayment: boolean;
};

export function PaymentIssuePanel({
  bookingId,
  customerEmail,
  serviceSlug,
  paymentFailureReason,
  canRetryPayment,
}: PaymentIssuePanelProps) {
  const airbnbCopy = isAirbnbCleaningSlug(serviceSlug)
    ? getAirbnbCustomerPaymentIssueCopy(paymentFailureReason)
    : null;
  const officeCopy = isOfficeCleaningSlug(serviceSlug)
    ? getOfficeCustomerPaymentIssueCopy(paymentFailureReason)
    : null;
  const movingCopy = isMovingCleaningSlug(serviceSlug)
    ? getMovingCustomerPaymentIssueCopy(paymentFailureReason)
    : null;
  const deepCopy = isDeepCleaningSlug(serviceSlug)
    ? getDeepCustomerPaymentIssueCopy(paymentFailureReason)
    : null;
  const carpetCopy = isCarpetCleaningSlug(serviceSlug)
    ? getCarpetCustomerPaymentIssueCopy(paymentFailureReason)
    : null;
  const regularCopy = isRegularCleaningSlug(serviceSlug)
    ? getRegularCustomerPaymentIssueCopy(paymentFailureReason)
    : null;
  const copy =
    airbnbCopy ??
    officeCopy ??
    movingCopy ??
    deepCopy ??
    carpetCopy ??
    regularCopy ??
    paymentIssuePanelCopy(paymentFailureReason);
  const reassurance = paymentIssuePanelReassurance(canRetryPayment);
  const assignmentNote =
    airbnbCopy?.assignmentNote ??
    officeCopy?.assignmentNote ??
    movingCopy?.assignmentNote ??
    deepCopy?.assignmentNote ??
    carpetCopy?.assignmentNote ??
    PAYMENT_FAILED_ASSIGNMENT_NOTE;
  const detailSteps = paymentIssueDetailSteps({
    assignmentNote,
    slotWarning: airbnbCopy?.slotWarning,
    canRetryPayment,
  });

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50/90 px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-5 sm:py-4">
      <h2 className="text-sm font-semibold text-zinc-900">{copy.title}</h2>
      <p className="mt-1.5 text-sm leading-snug text-zinc-600">{copy.body}</p>
      <p className="mt-2 text-sm font-medium leading-snug text-zinc-800">{reassurance}</p>

      <section className="mt-3 flex flex-col gap-2">
        {canRetryPayment ? (
          <RetryPaymentButton bookingId={bookingId} customerEmail={customerEmail} />
        ) : (
          <Link
            href="/customer/book"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Start a new booking
          </Link>
        )}
        {canRetryPayment ? (
          <Link href="/customer/book" className={UI_LINK_SECONDARY_ACTION_CLASS}>
            Start a new booking
          </Link>
        ) : null}
      </section>

      {detailSteps.length > 0 ? (
        <details className="mt-2.5 text-sm text-zinc-600">
          <summary className="cursor-pointer font-medium text-zinc-600 hover:text-zinc-900">
            More help
          </summary>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 leading-relaxed">
            {detailSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
