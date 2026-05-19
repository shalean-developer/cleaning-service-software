"use client";

import type { ReactNode } from "react";
import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  PricingBreakdown,
  PricingFrequency,
  ServiceSlug,
} from "@/features/pricing/server/types";
import { formatDateLabel, formatZar } from "../format";
import {
  getRecurringScheduleReviewNote,
  isRecurringFrequency,
} from "../recurringDisplay";
import {
  formatBedroomBathroomSummary,
  formatCleanerPreference,
  formatCompactBedBathSummary,
  formatExtraRoomsSummary,
  formatSuburbLocation,
  getCleaningIntensityLabel,
  getEquipmentSupplyCustomerLabel,
  getFrequencyLabel,
  getReviewNextStepsNote,
  getSelectedAddonLabels,
  getTeamSupportReviewSummaryLabel,
} from "../reviewDisplay";
import { resolveWizardContactPhone } from "../contactPhone";
import { formatZaMobileForDisplay } from "@/lib/validation/zaPhone";
import type { CleanerPreferenceMode, WizardStep } from "../types";
import { WizardStepHeading } from "./WizardStepHeading";

type SummaryRowProps = {
  label: string;
  value: string;
  valueClassName?: string;
};

function SummaryRow({ label, value, valueClassName = "text-zinc-900" }: SummaryRowProps) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <span className="shrink-0 text-xs text-zinc-500">{label}</span>
      <span
        className={`min-w-0 break-words text-sm font-medium sm:text-right [overflow-wrap:anywhere] ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

function ReviewSection({
  title,
  editStep,
  onEditStep,
  children,
  className = "",
}: {
  title: string;
  editStep?: WizardStep;
  onEditStep?: (step: WizardStep) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-b border-zinc-100/90 py-2 last:border-b-0 md:py-2.5 ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2 md:mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
        {editStep && onEditStep ? (
          <button
            type="button"
            onClick={() => onEditStep(editStep)}
            className="shrink-0 text-xs font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
          >
            Edit
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ReviewCompactHero({
  segments,
}: {
  segments: string[];
}) {
  return (
    <header className="mb-2.5 rounded-lg border border-zinc-100 bg-zinc-50/70 px-3 py-2 md:mb-3 md:rounded-xl md:px-3.5 md:py-2.5">
      <p className="break-words text-sm font-medium leading-snug text-zinc-900 [overflow-wrap:anywhere]">
        {segments.join(" · ")}
      </p>
    </header>
  );
}

type Props = {
  serviceLabel: string;
  serviceSlug: ServiceSlug | null;
  date: string;
  time: string;
  addressLine1: string;
  suburb: string;
  city: string;
  locationNotes: string;
  contactPhone: string;
  profilePhone: string | null;
  bedrooms: number;
  bathrooms: number;
  extraRooms: number;
  cleaningIntensity: CleaningIntensity;
  equipmentSupply: EquipmentSupply;
  requestedTeamSize: 1 | 2;
  propertySizeSqm: number | null;
  frequency: PricingFrequency;
  addons: AddonSlug[];
  cleanerPreferenceMode: CleanerPreferenceMode;
  selectedCleanerDisplayName: string | null;
  quote: PricingBreakdown;
  reviewConfirmed: boolean;
  onReviewConfirmedChange: (checked: boolean) => void;
  onEditStep?: (step: WizardStep) => void;
  reviewConfirmedError?: string;
};

export function ReviewStepPanel({
  serviceLabel,
  serviceSlug,
  date,
  time,
  addressLine1,
  suburb,
  city,
  locationNotes,
  contactPhone,
  profilePhone,
  bedrooms,
  bathrooms,
  extraRooms,
  cleaningIntensity,
  equipmentSupply,
  requestedTeamSize,
  propertySizeSqm,
  frequency,
  addons,
  cleanerPreferenceMode,
  selectedCleanerDisplayName,
  quote,
  reviewConfirmed,
  onReviewConfirmedChange,
  onEditStep,
  reviewConfirmedError,
}: Props) {
  const { bedroomsLabel, bathroomsLabel } = formatBedroomBathroomSummary(
    serviceSlug,
    bedrooms,
    bathrooms,
    propertySizeSqm,
  );
  const streetAddress = addressLine1.trim() || "\u2014";
  const scheduleLabel = formatDateLabel(date, time) || "\u2014";
  const locationLabel = formatSuburbLocation(suburb, city);
  const accessNotes = locationNotes.trim();
  const contactPhoneLabel =
    formatZaMobileForDisplay(resolveWizardContactPhone(contactPhone, profilePhone)) ??
    "\u2014";
  const extraRoomsLabel = formatExtraRoomsSummary(extraRooms);
  const intensityLabel =
    serviceSlug === "regular-cleaning"
      ? getCleaningIntensityLabel(cleaningIntensity)
      : null;
  const equipmentSupplyLabel =
    serviceSlug === "regular-cleaning"
      ? getEquipmentSupplyCustomerLabel(equipmentSupply)
      : null;
  const teamSupportLabel =
    serviceSlug === "regular-cleaning"
      ? getTeamSupportReviewSummaryLabel(requestedTeamSize) ??
        (requestedTeamSize === 1 ? "1 cleaner" : null)
      : null;
  const recurringScheduleNote = getRecurringScheduleReviewNote(frequency);
  const bedBathSummary = formatCompactBedBathSummary(
    serviceSlug,
    bedrooms,
    bathrooms,
    propertySizeSqm,
  );
  const addonLabels = getSelectedAddonLabels(addons, serviceSlug);
  const cleanerPreferenceLabel = formatCleanerPreference(
    cleanerPreferenceMode,
    selectedCleanerDisplayName,
  );

  const heroSegments = [
    serviceLabel,
    bedBathSummary,
    getFrequencyLabel(frequency),
    scheduleLabel,
  ].filter(Boolean) as string[];

  return (
    <div>
      <WizardStepHeading title="Review" />

      <ReviewCompactHero segments={heroSegments} />

      <section aria-labelledby="review-pricing-summary-heading" className="mb-2.5 md:mb-3">
        <h3
          id="review-pricing-summary-heading"
          className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500"
        >
          Price breakdown
        </h3>
        <ul className="divide-y divide-zinc-100/80 text-sm">
          {quote.lineItems.map((item) => (
            <li
              key={item.code}
              className={`flex justify-between gap-3 py-1.5 first:pt-0 ${
                item.code === "frequency_discount"
                  ? "text-emerald-700"
                  : item.code === "cleaning_intensity" || item.code === "team_support_request"
                    ? "text-zinc-800"
                    : "text-zinc-600"
              }`}
            >
              <span className="min-w-0 break-words">{item.label}</span>
              <span className="shrink-0 tabular-nums font-medium">
                {formatZar(item.amountCents)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-zinc-200 pt-2">
          <span className="text-sm font-semibold text-zinc-900">Total</span>
          <span
            className="text-lg font-semibold tabular-nums text-zinc-900 md:text-xl"
            aria-label={`Total ${formatZar(quote.totalCents)}`}
          >
            {formatZar(quote.totalCents)}
          </span>
        </div>
        {isRecurringFrequency(frequency) ? (
          <p className="mt-1.5 text-xs leading-snug text-zinc-500">
            {recurringScheduleNote ?? "Recurring booking."} Today&apos;s total is for this visit
            only.
          </p>
        ) : null}
      </section>

      <p className="mb-2.5 text-xs leading-snug text-zinc-600 md:mb-3">{getReviewNextStepsNote()}</p>

      <details className="group mb-2.5 rounded-lg border border-zinc-100 bg-white open:mb-3 md:mb-3">
        <summary className="min-h-11 cursor-pointer list-none px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">
            Booking details
            <span
              className="text-[0.625rem] font-normal normal-case tracking-normal text-zinc-400 group-open:hidden"
              aria-hidden
            >
              (show)
            </span>
            <span
              className="hidden text-[0.625rem] font-normal normal-case tracking-normal text-zinc-400 group-open:inline"
              aria-hidden
            >
              (hide)
            </span>
          </span>
        </summary>

        <div className="border-t border-zinc-100/90 px-3 pb-1 pt-0.5">
          <ReviewSection title="Service options" editStep="datetime" onEditStep={onEditStep}>
            <div className="space-y-1.5">
              {intensityLabel ? (
                <SummaryRow label="Cleaning intensity" value={intensityLabel} />
              ) : null}
              {isRecurringFrequency(frequency) ? (
                <div className="flex flex-wrap items-center justify-end gap-2 sm:justify-between">
                  <span className="text-xs text-zinc-500 sm:sr-only">Cadence</span>
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white">
                    Recurring
                  </span>
                </div>
              ) : null}
            </div>
          </ReviewSection>

          <ReviewSection title="Property details" editStep="details" onEditStep={onEditStep}>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {bedroomsLabel ? <SummaryRow label="Bedrooms" value={bedroomsLabel} /> : null}
              {bathroomsLabel ? (
                <SummaryRow
                  label={serviceSlug === "office-cleaning" ? "Property size" : "Bathrooms"}
                  value={bathroomsLabel}
                />
              ) : null}
              {extraRoomsLabel ? (
                <SummaryRow label="Extra rooms" value={extraRoomsLabel} />
              ) : null}
              {equipmentSupplyLabel ? (
                <SummaryRow label="Cleaning supplies" value={equipmentSupplyLabel} />
              ) : null}
              {teamSupportLabel ? (
                <SummaryRow label="Team support" value={teamSupportLabel} />
              ) : null}
            </div>
            <div className="mt-2">
              <p className="text-xs text-zinc-500">Add-ons</p>
              {addonLabels.length > 0 ? (
                <ul className="mt-0.5 space-y-0.5 text-sm font-medium text-zinc-900">
                  {addonLabels.map((label) => (
                    <li key={label} className="flex gap-2">
                      <span className="text-zinc-400" aria-hidden>
                        {"\u2022"}
                      </span>
                      <span className="min-w-0 break-words">{label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-0.5 text-sm text-zinc-500">No add-ons selected</p>
              )}
            </div>
          </ReviewSection>

          <ReviewSection title="Location &amp; contact" editStep="location" onEditStep={onEditStep}>
            <div className="space-y-1.5">
              <SummaryRow label="Street address" value={streetAddress} />
              <SummaryRow label="City / suburb" value={locationLabel} />
              <SummaryRow label="Mobile number" value={contactPhoneLabel} />
              {accessNotes ? (
                <SummaryRow label="Access notes" value={accessNotes} />
              ) : null}
            </div>
          </ReviewSection>

          <ReviewSection title="Cleaner preference" editStep="cleaner" onEditStep={onEditStep}>
            <p className="text-sm text-zinc-700">{cleanerPreferenceLabel}</p>
          </ReviewSection>
        </div>
      </details>

      <label className="flex items-start gap-2.5 rounded-lg bg-zinc-50/80 px-3 py-2 text-sm ring-1 ring-zinc-100 md:py-2.5">
        <input
          type="checkbox"
          checked={reviewConfirmed}
          onChange={(e) => onReviewConfirmedChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300"
        />
        <span className="leading-snug text-zinc-700">
          I confirm these details are correct and I&apos;m ready for secure payment.
        </span>
      </label>
      {reviewConfirmedError ? (
        <p className="mt-1.5 text-sm text-red-600">{reviewConfirmedError}</p>
      ) : null}
    </div>
  );
}
