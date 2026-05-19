"use client";

import type { PricingFrequency } from "@/features/pricing/server/types";
import { FREQUENCY_STEP_OPTIONS } from "../constants";
import {
  DETAILS_STEP_SECTION,
  detailsCardClass,
  WIZARD_CARD_TRANSITION,
  WIZARD_FOCUS_RING,
} from "../detailsStepUi";
import { DetailsSectionHeading } from "./DetailsSectionHeading";

type Props = {
  value: PricingFrequency;
  onChange: (value: PricingFrequency) => void;
  error?: string;
};

export function FrequencyStepPanel({ value, onChange, error }: Props) {
  return (
    <section className={DETAILS_STEP_SECTION} aria-labelledby="frequency-step-label">
      <DetailsSectionHeading title="Frequency" id="frequency-step-label" />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2" role="radiogroup">
        {FREQUENCY_STEP_OPTIONS.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`flex min-h-[2.75rem] min-w-0 items-center justify-center rounded-xl border px-2 py-2 text-center ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${detailsCardClass(selected)}`}
            >
              <span className="text-sm font-semibold leading-snug text-zinc-900">{option.label}</span>
              <span className="sr-only">{option.description}</span>
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
