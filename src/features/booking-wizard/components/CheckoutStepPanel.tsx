"use client";

import type { PricingBreakdown, PricingFrequency, ServiceSlug } from "@/features/pricing/server/types";
import { formatDateLabel, formatZar } from "../format";
import {
  getRecurringPaymentExplanation,
  getRecurringScheduleExplanation,
  isRecurringFrequency,
} from "../recurringDisplay";
import {
  formatBedroomBathroomSummary,
  formatSuburbLocation,
} from "../reviewDisplay";
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
  frequency: PricingFrequency;
  quote: PricingBreakdown;
  customerEmail: string;
};

function buildMiniSummaryDetail(
  serviceSlug: ServiceSlug | null,
  bedrooms: number,
  bathrooms: number,
  propertySizeSqm: number | null,
): string | null {
  const { bedroomsLabel, bathroomsLabel } = formatBedroomBathroomSummary(
    serviceSlug,
    bedrooms,
    bathrooms,
    propertySizeSqm,
  );

  if (serviceSlug === "office-cleaning") {
    return bathroomsLabel;
  }

  if (!bedroomsLabel || !bathroomsLabel) return null;

  const bedShort = bedrooms === 1 ? "1 bed" : `${bedrooms} beds`;
  const bathShort = bathrooms === 1 ? "1 bath" : `${bathrooms} baths`;
  return `${bedShort} \u00b7 ${bathShort}`;
}

const REASSURANCE_ITEMS = [
  {
    title: "Secure payment",
    body: "Paystack processes your card on an encrypted checkout page.",
  },
  {
    title: "Booking confirmation",
    body: "When payment succeeds, your booking is recorded and no longer pending in the browser.",
  },
  {
    title: "Cleaner assignment",
    body: "We match an eligible cleaner to your schedule and preferences after payment.",
  },
  {
    title: "Email updates",
    body: "We email you at the address below with confirmation and next steps.",
  },
] as const;

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
  frequency,
  quote,
  customerEmail,
}: Props) {
  const scheduleLabel = formatDateLabel(date, time);
  const locationLabel = formatSuburbLocation(suburb, city);
  const homeDetail = buildMiniSummaryDetail(
    serviceSlug,
    bedrooms,
    bathrooms,
    propertySizeSqm,
  );
  const recurringPaymentNote = getRecurringPaymentExplanation(frequency);
  const recurringScheduleNote = getRecurringScheduleExplanation(frequency);

  return (
    <div>
      <WizardStepHeading
        title="Secure checkout"
        subtitle="Final step — pay once to confirm your booking."
      />

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900">
        <LockIcon className="h-5 w-5 shrink-0 text-emerald-700" />
        <span className="font-medium">Secured by Paystack</span>
      </div>

      <section
        aria-labelledby="checkout-summary-heading"
        className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        <h3 id="checkout-summary-heading" className="sr-only">
          Booking summary
        </h3>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
          {serviceLabel}
        </p>
        {scheduleLabel ? (
          <p className="mt-2 text-sm font-medium text-zinc-900">{scheduleLabel}</p>
        ) : null}
        {homeDetail ? <p className="mt-1 text-sm text-zinc-600">{homeDetail}</p> : null}
        {locationLabel !== "\u2014" ? (
          <p className="mt-1 break-words text-sm text-zinc-600">{locationLabel}</p>
        ) : null}
      </section>

      {isRecurringFrequency(frequency) && recurringPaymentNote ? (
        <section
          aria-labelledby="checkout-recurring-heading"
          className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4"
        >
          <h3
            id="checkout-recurring-heading"
            className="text-sm font-medium text-zinc-900"
          >
            Recurring clean
          </h3>
          {recurringScheduleNote ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              {recurringScheduleNote}
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            {recurringPaymentNote}
          </p>
        </section>
      ) : null}

      <div className="mb-4 hidden md:block">
        <p className="mb-1 text-sm font-medium text-zinc-700">Amount due today</p>
        <p className="text-2xl font-semibold tabular-nums text-zinc-900">
          {formatZar(quote.totalCents)}
        </p>
      </div>

      <section
        aria-labelledby="checkout-next-steps-heading"
        className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        <h3
          id="checkout-next-steps-heading"
          className="mb-3 text-sm font-medium text-zinc-800"
        >
          What happens after you pay
        </h3>
        <ul className="space-y-3">
          {REASSURANCE_ITEMS.map((item) => (
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

      <p className="mb-2 text-sm leading-relaxed text-zinc-600">
        Tap <span className="font-medium text-zinc-900">Pay with Paystack</span> below
        to open secure payment. Your booking stays{" "}
        <span className="font-medium text-zinc-800">pending payment</span> until
        Paystack confirms success.
      </p>

      <p className="text-sm text-zinc-600">
        Paying as <span className="font-medium text-zinc-900">{customerEmail}</span>
      </p>
    </div>
  );
}

