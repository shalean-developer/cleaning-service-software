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
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
      <h2 className="text-sm font-semibold text-zinc-900">{copy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{copy.body}</p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
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
              ? "text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
              : "inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          }
        >
          Start a new booking
        </Link>
      </section>
    </section>
  );
}
