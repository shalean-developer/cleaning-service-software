"use client";

import Link from "next/link";
import { LockIcon } from "@/features/booking-wizard/components/wizardIcons";
import {
  getAirbnbCustomerPaymentVerifyErrorCopy,
  getAirbnbCustomerSuccessCopy,
  isAirbnbCleaningSlug,
} from "@/features/dashboards/airbnbCustomerDisplay";
import {
  PAYMENT_SUCCESS_NEXT_STEPS,
  PAYMENT_VERIFY_ERROR_INTRO,
  PAYMENT_VERIFY_ERROR_NEXT_STEPS,
  PAYMENT_VERIFY_LOADING_COPY,
  PAYMENT_VERIFY_TRUST_LABEL,
  paymentSuccessLead,
  paymentSuccessTitle,
  type PaymentSuccessVariant,
} from "@/lib/app/paymentReturnDisplay";
import { PaymentVerificationSpinner } from "./PaymentVerificationSpinner";

export function PaymentVerifyTrustRow() {
  return (
    <div className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900">
      <LockIcon className="h-5 w-5 shrink-0 text-emerald-700" />
      <span className="font-medium">{PAYMENT_VERIFY_TRUST_LABEL}</span>
    </div>
  );
}

export function PaymentVerifyingPanel({ statusMessage }: { statusMessage: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <PaymentVerifyTrustRow />
      <PaymentVerificationSpinner />
      <div className="mt-6 space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
          {PAYMENT_VERIFY_LOADING_COPY.title}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600">{PAYMENT_VERIFY_LOADING_COPY.body}</p>
        <p className="text-sm leading-relaxed text-zinc-500">
          {PAYMENT_VERIFY_LOADING_COPY.reassurance}
        </p>
      </div>
      <p className="mt-6 border-t border-zinc-100 pt-5 text-xs font-medium text-zinc-500">
        {PAYMENT_VERIFY_LOADING_COPY.footnote}
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
    </div>
  );
}

function PaymentSuccessCheckIcon() {
  return (
    <div
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"
      aria-hidden
    >
      <svg
        className="h-7 w-7 text-emerald-800"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}

export function PaymentConfirmedPanel({
  variant,
  bookingDetailHref,
  serviceSlug,
}: {
  variant: PaymentSuccessVariant;
  bookingDetailHref: string;
  serviceSlug?: string | null;
}) {
  const airbnb = isAirbnbCleaningSlug(serviceSlug);
  const airbnbCopy = airbnb ? getAirbnbCustomerSuccessCopy(variant) : null;
  const title = airbnbCopy?.title ?? paymentSuccessTitle(variant);
  const lead = airbnbCopy?.lead ?? paymentSuccessLead(variant);
  const nextSteps = airbnbCopy?.nextSteps ?? PAYMENT_SUCCESS_NEXT_STEPS;
  const nextStepsHeading = airbnbCopy?.nextStepsHeading ?? "What happens next";
  const ctaLabel = airbnbCopy?.ctaLabel ?? "View booking details";
  const ctaFootnote = airbnbCopy?.ctaFootnote ?? "Opening your booking…";

  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      <div className="text-center">
        <PaymentSuccessCheckIcon />
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{lead}</p>
        {airbnbCopy?.guestReadyNote ? (
          <p className="mt-2 text-sm font-medium leading-relaxed text-emerald-900/90">
            {airbnbCopy.guestReadyNote}
          </p>
        ) : null}
      </div>

      <section
        aria-labelledby="payment-success-next-heading"
        className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 text-left"
      >
        <h3 id="payment-success-next-heading" className="text-sm font-medium text-zinc-800">
          {nextStepsHeading}
        </h3>
        <ul className="mt-3 space-y-3">
          {nextSteps.map((item) => (
            <li key={item.title} className="flex gap-3 text-sm">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400"
                aria-hidden
              />
              <div>
                <p className="font-medium text-zinc-900">{item.title}</p>
                <p className="mt-0.5 leading-relaxed text-zinc-600">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Link
        href={bookingDetailHref}
        className="rounded-xl bg-zinc-900 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.18)] hover:bg-zinc-800"
      >
        {ctaLabel}
      </Link>
      <p className="text-center text-xs text-zinc-500">{ctaFootnote}</p>
    </div>
  );
}

export function PaymentVerifyErrorPanel({
  message,
  onRetry,
  serviceSlug,
}: {
  message: string;
  onRetry: () => void;
  serviceSlug?: string | null;
}) {
  const airbnb = isAirbnbCleaningSlug(serviceSlug);
  const airbnbError = airbnb ? getAirbnbCustomerPaymentVerifyErrorCopy() : null;
  const panelTitle = airbnbError?.panelTitle ?? "Payment not confirmed yet";
  const intro = airbnbError?.intro ?? PAYMENT_VERIFY_ERROR_INTRO;
  const nextSteps = airbnbError?.nextSteps ?? PAYMENT_VERIFY_ERROR_NEXT_STEPS;

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{panelTitle}</h2>
        <p className="text-sm leading-relaxed text-zinc-600">{intro}</p>
        <p
          className="break-words rounded-xl border border-amber-100 bg-amber-50/90 px-3 py-2.5 text-sm leading-relaxed text-amber-950"
          role="alert"
        >
          {message}
        </p>
      </div>

      <section
        aria-labelledby="payment-verify-error-next-heading"
        className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4"
      >
        <h3 id="payment-verify-error-next-heading" className="text-sm font-medium text-zinc-800">
          What you can do
        </h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-600">
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Try again
        </button>
        <Link
          href="/customer/bookings"
          className="text-center text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
        >
          View my bookings
        </Link>
      </div>
    </div>
  );
}
