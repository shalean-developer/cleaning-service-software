"use client";

import type { PricingFrequency, ServiceSlug } from "@/features/pricing/server/types";
import { getFrequencySectionTitle, getFrequencyStepOptions } from "../airbnbCleaningDisplay";
import {
  DETAILS_OPTION_DESC,
  DETAILS_STEP_SECTION,
  detailsCardClass,
  WIZARD_CARD_TRANSITION,
  WIZARD_FOCUS_RING,
} from "../detailsStepUi";
import { DetailsSectionHeading } from "./DetailsSectionHeading";

type Props = {
  serviceSlug: ServiceSlug | null;
  value: PricingFrequency;
  onChange: (value: PricingFrequency) => void;
  error?: string;
};

export function FrequencyStepPanel({ serviceSlug, value, onChange, error }: Props) {
  const options = getFrequencyStepOptions(serviceSlug);

  return (
    <section className={DETAILS_STEP_SECTION} aria-labelledby="frequency-step-label">
      <DetailsSectionHeading
        title={getFrequencySectionTitle(serviceSlug)}
        id="frequency-step-label"
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2" role="radiogroup">
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`flex min-h-[2.75rem] min-w-0 flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${detailsCardClass(selected)}`}
            >
              <span className="text-sm font-semibold leading-snug text-zinc-900">{option.label}</span>
              <span className={`${DETAILS_OPTION_DESC} text-center`}>{option.description}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
