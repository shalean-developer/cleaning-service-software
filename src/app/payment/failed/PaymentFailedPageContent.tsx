import Link from "next/link";
import type { PaymentFailedPageModel } from "@/lib/app/paymentFailedPage";
import { paymentFailedReturnPageNextSteps } from "@/features/bookings/server/paymentFailurePresentation";
import { PaymentCustomerShell } from "../success/PaymentCustomerShell";
import { PaymentVerificationPanel } from "../success/PaymentVerificationShell";
import { UI_LINK_SECONDARY_ACTION_CLASS } from "@/lib/ui/productUiTokens";

type Props = {
  model: PaymentFailedPageModel;
};

function PaymentFailedCalmIcon() {
  return (
    <div
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100"
      aria-hidden
    >
      <svg
        className="h-7 w-7 text-zinc-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
    </div>
  );
}

export function PaymentFailedPageContent({ model }: Props) {
  const nextSteps = paymentFailedReturnPageNextSteps(model);

  return (
    <PaymentCustomerShell
      title="Payment not completed"
      subtitle="Your booking is saved. you can complete payment when ready"
    >
      <PaymentVerificationPanel>
        <section
          className="flex flex-col gap-5"
          role="status"
          aria-labelledby="payment-failed-title"
        >
          <div className="text-center sm:text-left">
            <PaymentFailedCalmIcon />
            <h1
              id="payment-failed-title"
              className="mt-4 text-xl font-semibold tracking-tight text-zinc-900"
            >
              {model.copy.title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{model.copy.body}</p>
            <p className="mt-2 text-sm font-medium leading-snug text-zinc-800">{model.reassurance}</p>
          </div>

          {nextSteps.length > 0 ? (
            <section
              aria-labelledby="payment-failed-next-heading"
              className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 text-left"
            >
              <h2 id="payment-failed-next-heading" className="text-sm font-medium text-zinc-800">
                What happens next
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-600">
                {nextSteps.map((step) => (
                  <li key={step} className="flex gap-3">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400"
                      aria-hidden
                    />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {model.bookingReferenceLabel ? (
            <p className="text-center text-xs font-medium uppercase tracking-wide text-zinc-500 sm:text-left">
              Booking reference{" "}
              <span className="font-mono normal-case tracking-normal text-zinc-800">
                {model.bookingReferenceLabel}
              </span>
            </p>
          ) : null}

          <div className="flex flex-col gap-2.5">
            {model.bookingDetailHref ? (
              <>
                <Link
                  href={model.bookingDetailHref}
                  className="rounded-xl bg-zinc-900 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.18)] hover:bg-zinc-800"
                >
                  Open booking to complete payment
                </Link>
                <Link href="/customer/bookings" className={UI_LINK_SECONDARY_ACTION_CLASS}>
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
            <Link href="/customer/book" className={UI_LINK_SECONDARY_ACTION_CLASS}>
              Start a new booking
            </Link>
          </div>

          <p className="border-t border-zinc-100 pt-4 text-center text-xs leading-relaxed text-zinc-500 sm:text-left">
            {model.supportNote}
          </p>
        </section>
      </PaymentVerificationPanel>
    </PaymentCustomerShell>
  );
}
