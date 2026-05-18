import Link from "next/link";
import type { PaymentFailedPageModel } from "@/lib/app/paymentFailedPage";
import {
  PaymentVerificationPanel,
  PaymentVerificationShell,
} from "../success/PaymentVerificationShell";

type Props = {
  model: PaymentFailedPageModel;
};

export function PaymentFailedPageContent({ model }: Props) {
  return (
    <PaymentVerificationShell>
      <PaymentVerificationPanel>
        <section
          className="flex flex-col gap-5"
          role="status"
          aria-labelledby="payment-failed-title"
        >
          <div className="space-y-2 text-center sm:text-left">
            <h1
              id="payment-failed-title"
              className="text-lg font-semibold tracking-tight text-zinc-900"
            >
              {model.copy.title}
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600">{model.copy.body}</p>
          </div>

          <section
            aria-labelledby="payment-failed-next-heading"
            className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4"
          >
            <h2 id="payment-failed-next-heading" className="text-sm font-medium text-zinc-800">
              What happens next
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-600">
              <li>{model.assignmentNote}</li>
              <li>{model.retryGuidance}</li>
            </ul>
          </section>

          {model.bookingReferenceLabel ? (
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Booking reference{" "}
              <span className="font-mono normal-case tracking-normal text-zinc-800">
                {model.bookingReferenceLabel}
              </span>
            </p>
          ) : null}

          <div className="flex flex-col gap-3">
            {model.bookingDetailHref ? (
              <>
                <Link
                  href={model.bookingDetailHref}
                  className="rounded-xl bg-zinc-900 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.18)] hover:bg-zinc-800"
                >
                  View booking to retry payment
                </Link>
                <Link
                  href="/customer/bookings"
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Go to my bookings
                </Link>
              </>
            ) : (
              <Link
                href="/customer/bookings"
                className="rounded-xl bg-zinc-900 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.18)] hover:bg-zinc-800"
              >
                Go to my bookings
              </Link>
            )}
            <Link
              href="/customer/book"
              className="text-center text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
            >
              Start a new booking
            </Link>
          </div>

          <p className="border-t border-zinc-100 pt-4 text-xs leading-relaxed text-zinc-500">
            {model.supportNote}
          </p>
        </section>
      </PaymentVerificationPanel>
    </PaymentVerificationShell>
  );
}
