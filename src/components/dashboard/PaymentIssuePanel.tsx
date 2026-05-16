import Link from "next/link";
import type { PaymentFailureReason } from "@/features/bookings/server/paymentFailureDisplay";
import { paymentIssuePanelCopy } from "@/features/bookings/server/paymentFailureDisplay";
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

  return (
    <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-sm font-semibold text-red-900">{copy.title}</h2>
      <p className="mt-2 text-sm text-red-800">{copy.body}</p>
      <p className="mt-3 text-sm text-red-800">
        No cleaner is assigned until payment succeeds. Complete checkout to continue.
      </p>
      <section className="mt-4 flex flex-wrap items-center gap-3">
        {canRetryPayment ? (
          <RetryPaymentButton bookingId={bookingId} customerEmail={customerEmail} />
        ) : null}
        <Link
          href="/customer/book"
          className={
            canRetryPayment
              ? "text-sm font-medium text-red-900 underline hover:text-red-950"
              : "inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          }
        >
          Start a new booking
        </Link>
      </section>
    </section>
  );
}
