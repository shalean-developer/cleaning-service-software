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
  getRecurringScheduleExplanation,
  isRecurringFrequency,
} from "../recurringDisplay";
import {
  formatBedroomBathroomSummary,
  formatExtraRoomsSummary,
  formatCleanerPreference,
  formatSelectedAddons,
  formatSuburbLocation,
  getCleaningIntensityLabel,
  getEquipmentSupplyCustomerLabel,
  getFrequencyLabel,
  getTeamSupportCustomerLabel,
} from "../reviewDisplay";
import { resolveWizardContactPhone } from "../contactPhone";
import { formatZaMobileForDisplay } from "@/lib/validation/zaPhone";
import type { CleanerPreferenceMode, WizardStep } from "../types";
import { WizardStepHeading } from "./WizardStepHeading";

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900 sm:text-right">{value}</dd>
    </div>
  );
}

function SectionCard({
  title,
  editStep,
  onEditStep,
  children,
}: {
  title: string;
  editStep?: WizardStep;
  onEditStep?: (step: WizardStep) => void;
  children: ReactNode;
}) {
  return (
    <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-800">{title}</h3>
        {editStep && onEditStep ? (
          <button
            type="button"
            onClick={() => onEditStep(editStep)}
            className="shrink-0 text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
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
      ? getTeamSupportCustomerLabel(requestedTeamSize)
      : null;
  const recurringScheduleNote = getRecurringScheduleExplanation(frequency);
  const hasAddons = addons.length > 0;

  return (
    <div>
      <WizardStepHeading title="Review" />

      <div className="mb-4 rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
            {serviceLabel}
          </p>
          <p className="mt-2 text-base font-semibold leading-snug text-zinc-900">
            {locationLabel}
          </p>
          {streetAddress !== "\u2014" ? (
            <p className="mt-0.5 text-sm text-zinc-500">{streetAddress}</p>
          ) : null}
        </div>
      </div>

      <SectionCard title="Schedule" editStep="datetime" onEditStep={onEditStep}>
        <dl className="space-y-2.5 text-sm">
          <SummaryRow label="Date & time" value={scheduleLabel} />
        </dl>
        <div className="mt-4 rounded-xl border border-zinc-200/90 bg-zinc-50/90 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Frequency
              </p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                {getFrequencyLabel(frequency)}
              </p>
              {recurringScheduleNote ? (
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
                  {recurringScheduleNote}
                </p>
              ) : null}
            </div>
            {isRecurringFrequency(frequency) ? (
              <span className="shrink-0 rounded-full bg-zinc-900 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white">
                Recurring
              </span>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Home & plan" editStep="details" onEditStep={onEditStep}>
        <dl className="space-y-2.5 text-sm">
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
          {intensityLabel ? (
            <SummaryRow label="Cleaning intensity" value={intensityLabel} />
          ) : null}
          {equipmentSupplyLabel ? (
            <SummaryRow label="Cleaning supplies" value={equipmentSupplyLabel} />
          ) : null}
          {teamSupportLabel ? (
            <SummaryRow label="Team support" value={teamSupportLabel} />
          ) : null}
        </dl>
        <div className="mt-4 rounded-xl border border-zinc-200/90 bg-zinc-50/90 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Add-ons</p>
          <p
            className={`mt-0.5 text-sm font-medium ${
              hasAddons ? "text-zinc-900" : "text-zinc-500"
            }`}
          >
            {formatSelectedAddons(addons)}
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Location" editStep="location" onEditStep={onEditStep}>
        <dl className="space-y-2.5 text-sm">
          <SummaryRow label="Suburb" value={locationLabel} />
          <SummaryRow label="Street" value={streetAddress} />
          <SummaryRow label="Mobile" value={contactPhoneLabel} />
        </dl>
      </SectionCard>

      <SectionCard title="Cleaner" editStep="cleaner" onEditStep={onEditStep}>
        <p className="text-sm font-medium text-zinc-900">
          {formatCleanerPreference(cleanerPreferenceMode, selectedCleanerDisplayName)}
        </p>
      </SectionCard>

      <section
        aria-labelledby="review-pricing-summary-heading"
        className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        <h3
          id="review-pricing-summary-heading"
          className="mb-3 text-sm font-medium text-zinc-800"
        >
          Price breakdown
        </h3>
        <ul className="space-y-1 text-sm">
          {quote.lineItems.map((item) => (
            <li
              key={item.code}
              className={`flex justify-between gap-3 py-1 ${
                item.code === "frequency_discount"
                  ? "text-emerald-700"
                  :                 item.code === "cleaning_intensity" || item.code === "team_support_request"
                    ? "text-zinc-800"
                    : "text-zinc-700"
              }`}
            >
              <span>{item.label}</span>
              <span className="shrink-0 tabular-nums">{formatZar(item.amountCents)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 hidden border-t border-zinc-100 pt-3 text-2xl font-semibold tabular-nums text-zinc-900 md:block">
          Total {formatZar(quote.totalCents)}
        </p>
      </section>

      <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3.5 text-sm">
        <input
          type="checkbox"
          checked={reviewConfirmed}
          onChange={(e) => onReviewConfirmedChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300"
        />
        <span>
          I confirm these details are correct and I am ready to continue to secure payment.
        </span>
      </label>
      {reviewConfirmedError ? (
        <p className="mt-2 text-sm text-red-600">{reviewConfirmedError}</p>
      ) : null}
    </div>
  );
}

