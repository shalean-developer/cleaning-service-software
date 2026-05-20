"use client";

import type {
  PricingBreakdown,
  PricingFrequency,
  ServiceSlug,
} from "@/features/pricing/server/types";
import { formatDateLabel, formatZar } from "../format";
import {
  getCheckoutAmountHelper,
  getCheckoutGuestReadyNote,
  getCheckoutWhatHappensNext,
} from "../airbnbCleaningDisplay";
import { showFrequencyForService } from "../frequencyVisibility";
import {
  getRecurringPaymentExplanation,
  isRecurringFrequency,
} from "../recurringDisplay";
import { isOfficeCleaningSlug } from "../officeCleaningDisplay";
import type { OfficeSizeTier, OfficeWorkstationTier } from "../officeSizing";
import { formatCompactBedBathSummary, formatSuburbLocation } from "../reviewDisplay";
import { LockIcon } from "./wizardIcons";
import { WizardStepHeading } from "./WizardStepHeading";

type Props = {
  serviceLabel: string;
  serviceSlug: ServiceSlug | null;
  date: string;
  time: string;
  suburb: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  propertySizeSqm: number | null;
  officeSizeTier?: OfficeSizeTier | null;
  officeWorkstations?: OfficeWorkstationTier | null;
  frequency: PricingFrequency;
  quote: PricingBreakdown;
  customerEmail: string;
};

const CTA_TRUST_ITEMS = [
  "Secure payment",
  "Instant confirmation",
  "Trusted local cleaners",
] as const;

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" className={className} aria-hidden>
      <path
        d="M6 1 9.5 2.25V5.5c0 2-1.5 3.75-3.5 4.5C3.5 9.25 2 7.5 2 5.5V2.25L6 1Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M4.25 6 5.5 7.25 8 4.75"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Trust copy shown beside the checkout CTA (mobile sticky footer + desktop). */
export function CheckoutCtaTrustRow({ className = "" }: { className?: string }) {
  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 ${className}`.trim()}
      aria-label="Checkout assurances"
    >
      {CTA_TRUST_ITEMS.map((item) => (
        <li key={item} className="inline-flex items-center gap-1 text-[0.6875rem] text-zinc-600">
          <ShieldCheckIcon className="h-3 w-3 shrink-0 text-emerald-700" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CheckoutStepPanel({
  serviceLabel,
  serviceSlug,
  date,
  time,
  suburb,
  city,
  bedrooms,
  bathrooms,
  propertySizeSqm,
  officeSizeTier = null,
  officeWorkstations = null,
  frequency,
  quote,
  customerEmail,
}: Props) {
  const scheduleLabel = formatDateLabel(date, time) || "\u2014";
  const locationLabel = formatSuburbLocation(suburb, city);
  const officeSizing = isOfficeCleaningSlug(serviceSlug)
    ? { officeSizeTier, officeWorkstations }
    : null;
  const bedBathSummary = formatCompactBedBathSummary(
    serviceSlug,
    bedrooms,
    bathrooms,
    propertySizeSqm,
    officeSizing,
  );
  const showFrequency = showFrequencyForService(serviceSlug);
  const recurringPaymentNote = showFrequency
    ? getRecurringPaymentExplanation(frequency, serviceSlug)
    : null;
  const guestReadyNote = getCheckoutGuestReadyNote(serviceSlug);
  const whatHappensNext = getCheckoutWhatHappensNext(serviceSlug);
  const amountHelper = getCheckoutAmountHelper(
    serviceSlug,
    customerEmail,
    showFrequency && isRecurringFrequency(frequency) ? recurringPaymentNote : null,
  );

  const snapshotMeta = [bedBathSummary, locationLabel !== "\u2014" ? locationLabel : null].filter(
    Boolean,
  );

  return (
    <div className="space-y-2.5">
      <WizardStepHeading title="Secure payment" />

      <header
        aria-label="Booking snapshot"
        className="rounded-lg border border-zinc-200/90 bg-zinc-50/70 px-3 py-2"
      >
        <p className="text-sm font-semibold text-zinc-900">{serviceLabel}</p>
        <p className="mt-0.5 text-sm text-zinc-800">{scheduleLabel}</p>
        {snapshotMeta.length > 0 ? (
          <p className="mt-0.5 text-xs leading-snug text-zinc-600">{snapshotMeta.join(" · ")}</p>
        ) : null}
        {guestReadyNote ? (
          <p className="mt-1.5 text-xs leading-snug text-emerald-900/90">{guestReadyNote}</p>
        ) : null}
      </header>

      <div
        className="flex items-start gap-2 rounded-lg border border-emerald-100/90 bg-emerald-50/60 px-3 py-2"
        role="status"
      >
        <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-950">Secure checkout</p>
          <p className="mt-0.5 text-xs leading-snug text-emerald-900/85">
            Processed securely by Paystack
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1" aria-hidden>
            {["Visa", "Mastercard", "EFT"].map((method) => (
              <span
                key={method}
                className="rounded border border-emerald-200/80 bg-white/80 px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-emerald-800/90"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section
        aria-labelledby="checkout-amount-heading"
        className="rounded-lg border border-zinc-300/80 bg-white px-3 py-2.5 ring-1 ring-zinc-900/5"
      >
        <p
          id="checkout-amount-heading"
          className="text-[0.6875rem] font-semibold uppercase tracking-wide text-zinc-500"
        >
          Amount due today
        </p>
        <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">
          {formatZar(quote.totalCents)}
        </p>
        {amountHelper ? (
          <p className="mt-1 text-xs leading-snug text-zinc-600">{amountHelper}</p>
        ) : null}
      </section>

      <section aria-labelledby="checkout-next-heading">
        <h3
          id="checkout-next-heading"
          className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500"
        >
          What happens next
        </h3>
        <ul className="space-y-1">
          {whatHappensNext.map((step) => (
            <li key={step} className="flex items-center gap-2 text-sm text-zinc-800">
              <span
                className="h-1 w-1 shrink-0 rounded-full bg-emerald-600"
                aria-hidden
              />
              {step}
            </li>
          ))}
        </ul>
      </section>

      <CheckoutCtaTrustRow className="hidden pt-0.5 md:flex" />
    </div>
  );
}
