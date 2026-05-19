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
import { formatDateLabel, formatTimeLabel, formatZar } from "../format";
import {
  getRecurringScheduleExplanation,
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
  getSelectedAddonLabels,
  getTeamSupportExplanation,
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
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-sm font-medium sm:text-right ${valueClassName}`}>{value}</span>
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
    <section className={`border-b border-zinc-100/90 py-3.5 last:border-b-0 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
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
  const dateLabel = formatDateLabel(date, "") || "\u2014";
  const timeLabel = formatTimeLabel(time) || time || "\u2014";
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
  const teamSupportExplanation =
    serviceSlug === "regular-cleaning" ? getTeamSupportExplanation(requestedTeamSize) : null;
  const recurringScheduleNote = getRecurringScheduleExplanation(frequency);
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

  return (
    <div>
      <WizardStepHeading title="Review" />

      <header className="mb-3 rounded-xl bg-zinc-50/80 px-3.5 py-3 ring-1 ring-zinc-100">
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-zinc-500">Service</dt>
            <dd className="text-right font-semibold text-zinc-900">{serviceLabel}</dd>
          </div>
          {bedBathSummary ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-zinc-500">Beds / baths</dt>
              <dd className="text-right font-medium text-zinc-800">{bedBathSummary}</dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-zinc-500">Frequency</dt>
            <dd className="text-right font-medium text-zinc-800">{getFrequencyLabel(frequency)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-zinc-500">Date &amp; time</dt>
            <dd className="text-right font-medium text-zinc-800">{scheduleLabel}</dd>
          </div>
        </dl>
        <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-zinc-200/70 pt-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Total</span>
          <span className="text-lg font-semibold tabular-nums text-zinc-900">
            {formatZar(quote.totalCents)}
          </span>
        </div>
      </header>

      <div className="divide-y divide-zinc-100/90">
        <ReviewSection title="Service &amp; schedule" editStep="datetime" onEditStep={onEditStep}>
          <div className="space-y-2">
            <SummaryRow label="Service type" value={serviceLabel} />
            {intensityLabel ? (
              <SummaryRow label="Cleaning intensity" value={intensityLabel} />
            ) : null}
            <SummaryRow label="Frequency" value={getFrequencyLabel(frequency)} />
            {isRecurringFrequency(frequency) ? (
              <div className="flex justify-end">
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white">
                  Recurring
                </span>
              </div>
            ) : null}
            {recurringScheduleNote ? (
              <p className="text-xs leading-relaxed text-zinc-600 sm:text-right">
                {recurringScheduleNote}
              </p>
            ) : null}
            <SummaryRow label="Date" value={dateLabel} />
            <SummaryRow label="Time" value={timeLabel} />
          </div>
        </ReviewSection>

        <ReviewSection title="Property details" editStep="details" onEditStep={onEditStep}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
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
            {teamSupportExplanation ? (
              <p className="mt-1 text-xs leading-snug text-zinc-500 sm:col-span-2">
                {teamSupportExplanation}
              </p>
            ) : null}
          </div>
          <div className="mt-2.5">
            <p className="text-xs text-zinc-500">Add-ons</p>
            {addonLabels.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-sm font-medium text-zinc-900">
                {addonLabels.map((label) => (
                  <li key={label} className="flex gap-2">
                    <span className="text-zinc-400" aria-hidden>
                      {"\u2022"}
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">No add-ons selected</p>
            )}
          </div>
        </ReviewSection>

        <ReviewSection title="Location &amp; contact" editStep="location" onEditStep={onEditStep}>
          <div className="space-y-2">
            <SummaryRow label="Street address" value={streetAddress} />
            <SummaryRow label="City / suburb" value={locationLabel} />
            <SummaryRow label="Mobile number" value={contactPhoneLabel} />
            {accessNotes ? (
              <SummaryRow label="Access notes" value={accessNotes} />
            ) : null}
          </div>
        </ReviewSection>

        <ReviewSection title="Cleaner preference" editStep="cleaner" onEditStep={onEditStep}>
          <p className="rounded-lg bg-zinc-50/90 px-3 py-2 text-sm text-zinc-700">
            {cleanerPreferenceLabel}
          </p>
        </ReviewSection>

        <section
          aria-labelledby="review-pricing-summary-heading"
          className="py-3.5"
        >
          <h3
            id="review-pricing-summary-heading"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
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
                <span>{item.label}</span>
                <span className="shrink-0 tabular-nums font-medium">
                  {formatZar(item.amountCents)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-zinc-200 pt-2.5">
            <span className="text-sm font-semibold text-zinc-900">Total</span>
            <span className="text-xl font-semibold tabular-nums text-zinc-900">
              {formatZar(quote.totalCents)}
            </span>
          </div>
        </section>
      </div>

      <label className="mt-3 flex items-start gap-2.5 rounded-lg bg-zinc-50/80 px-3 py-2.5 text-sm ring-1 ring-zinc-100">
        <input
          type="checkbox"
          checked={reviewConfirmed}
          onChange={(e) => onReviewConfirmedChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300"
        />
        <span className="leading-snug text-zinc-700">
          I confirm these details are correct and I am ready to continue to secure payment.
        </span>
      </label>
      {reviewConfirmedError ? (
        <p className="mt-1.5 text-sm text-red-600">{reviewConfirmedError}</p>
      ) : null}
    </div>
  );
}
