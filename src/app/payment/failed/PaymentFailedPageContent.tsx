import Link from "next/link";
import type { PaymentFailedPageModel } from "@/lib/app/paymentFailedPage";

type Props = {
  model: PaymentFailedPageModel;
};

export function PaymentFailedPageContent({ model }: Props) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:py-16">
      <section
        className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm"
        role="status"
        aria-labelledby="payment-failed-title"
      >
        <h1 id="payment-failed-title" className="text-lg font-semibold text-red-950">
          {model.copy.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-red-900">{model.copy.body}</p>
        <p className="mt-3 text-sm leading-6 text-red-900">{model.assignmentNote}</p>
        <p className="mt-2 text-sm leading-6 text-red-800">{model.retryGuidance}</p>

        {model.bookingReferenceLabel ? (
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-red-800/90">
            Booking reference{" "}
            <span className="font-mono normal-case tracking-normal text-red-950">
              {model.bookingReferenceLabel}
            </span>
          </p>
        ) : null}

        <section className="mt-6 flex flex-col gap-3">
          {model.bookingDetailHref ? (
            <>
              <Link
                href={model.bookingDetailHref}
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800"
              >
                View booking to retry payment
              </Link>
              <Link
                href="/customer/bookings"
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-red-950 hover:bg-red-50/80"
              >
                Go to my bookings
              </Link>
            </>
          ) : (
            <Link
              href="/customer/bookings"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800"
            >
              Go to my bookings
            </Link>
          )}
          <Link
            href="/customer/book"
            className="text-center text-sm font-medium text-red-900 underline-offset-2 hover:underline"
          >
            Start a new booking
          </Link>
        </section>

        <p className="mt-6 border-t border-red-200/80 pt-4 text-xs leading-5 text-red-800">
          {model.supportNote}
        </p>
      </section>
    </main>
  );
}
