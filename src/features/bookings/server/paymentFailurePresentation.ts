import type { PaymentFailedPageModel } from "@/lib/app/paymentFailedPage";
import {
  PAYMENT_FAILED_RETRY_GUIDANCE,
  PAYMENT_RETRY_FRESH_CHECKOUT_HINT,
  PAYMENT_RETRY_NOT_ELIGIBLE_EXPLANATION,
} from "./paymentFailureDisplay";

/** Footer on failed return page. avoids repeating reassurance shown above. */
export const PAYMENT_FAILED_PAGE_FOOTER_HINT =
  "Need help? Contact support with your booking reference." as const;

/** Next-step bullets on failed return when customer can open the booking. */
export function paymentFailedReturnPageNextSteps(
  model: Pick<PaymentFailedPageModel, "bookingDetailHref" | "retryGuidance">,
): readonly string[] {
  if (model.bookingDetailHref) {
    return [model.retryGuidance];
  }
  return [PAYMENT_FAILED_RETRY_GUIDANCE];
}

/** Collapsed payment details on booking detail (assignment note lives here only). */
export function paymentIssueDetailSteps(options: {
  assignmentNote: string;
  slotWarning?: string | null;
  canRetryPayment: boolean;
}): readonly string[] {
  const steps: string[] = [];
  if (options.canRetryPayment) {
    steps.push(PAYMENT_RETRY_FRESH_CHECKOUT_HINT);
  } else {
    steps.push(PAYMENT_RETRY_NOT_ELIGIBLE_EXPLANATION);
  }
  if (options.slotWarning?.trim()) {
    steps.push(options.slotWarning.trim());
  }
  if (options.assignmentNote.trim()) {
    steps.push(options.assignmentNote.trim());
  }
  return steps;
}
