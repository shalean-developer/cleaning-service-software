import Link from "next/link";
import type { PaymentFailureReason } from "@/features/bookings/server/paymentFailureDisplay";
import {
  PAYMENT_FAILED_ASSIGNMENT_NOTE,
  PAYMENT_RETRY_FRESH_CHECKOUT_HINT,
  PAYMENT_RETRY_NOT_ELIGIBLE_EXPLANATION,
  paymentIssuePanelCopy,
  paymentIssuePanelReassurance,
} from "@/features/bookings/server/paymentFailureDisplay";
import { RetryPaymentButton } from "./RetryPaymentButton";

type PaymentIssuePanelProps = {
  bookingId: string;
  customerEmail: string;
  paymentFailureReason?: PaymentFailureReason;
  canRetryPayment: boolean;
};

export function PaymentIssuePanel({
  bookingId,
  customerEmail,
  paymentFailureReason,
  canRetryPayment,
}: PaymentIssuePanelProps) {
  const copy = paymentIssuePanelCopy(paymentFailureReason);
  const reassurance = paymentIssuePanelReassurance(canRetryPayment);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50/90 px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-5 sm:py-4">
      <h2 className="text-sm font-semibold text-zinc-900">{copy.title}</h2>
      <p className="mt-1.5 text-sm leading-snug text-zinc-600">{copy.body}</p>
      <p className="mt-2 text-sm font-medium leading-snug text-zinc-800">{reassurance}</p>

      <section className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        {canRetryPayment ? (
          <RetryPaymentButton bookingId={bookingId} customerEmail={customerEmail} />
        ) : null}
        <Link
          href="/customer/book"
          className={
            canRetryPayment
              ? "text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
              : "inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          }
        >
          Start a new booking
        </Link>
      </section>

      <details className="mt-2.5 text-sm text-zinc-600">
        <summary className="cursor-pointer font-medium text-zinc-600 hover:text-zinc-900">
          Payment details
        </summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>{PAYMENT_FAILED_ASSIGNMENT_NOTE}</p>
          {canRetryPayment ? (
            <p>{PAYMENT_RETRY_FRESH_CHECKOUT_HINT}</p>
          ) : (
            <p>{PAYMENT_RETRY_NOT_ELIGIBLE_EXPLANATION}</p>
          )}
        </div>
      </details>
    </section>
  );
}
