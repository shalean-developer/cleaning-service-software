"use client";

import type { CleaningIntensity } from "@/features/pricing/server/types";
import { CLEANING_INTENSITY_STEP_OPTIONS } from "../constants";
import {
  DETAILS_STEP_SECTION,
  detailsCardClass,
  WIZARD_CARD_TRANSITION,
  WIZARD_FOCUS_RING,
} from "../detailsStepUi";
import { DetailsSectionHeading } from "./DetailsSectionHeading";

type Props = {
  value: CleaningIntensity;
  onChange: (value: CleaningIntensity) => void;
  error?: string;
};

export function CleaningIntensityStepPanel({ value, onChange, error }: Props) {
  return (
    <section className={DETAILS_STEP_SECTION} aria-labelledby="cleaning-intensity-step-label">
      <DetailsSectionHeading title="Cleaning intensity" id="cleaning-intensity-step-label" />

      <div
        className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3"
        role="radiogroup"
        aria-labelledby="cleaning-intensity-step-label"
      >
        {CLEANING_INTENSITY_STEP_OPTIONS.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`flex min-w-0 flex-col rounded-lg border px-2.5 py-2 text-left ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${detailsCardClass(selected)}`}
            >
              <span className="block text-sm font-semibold leading-snug text-shalean-navy">
                {option.label}
              </span>
              <span className="mt-0.5 block text-[11px] font-medium tabular-nums leading-snug text-slate-500 sm:text-xs">
                {option.description}
              </span>
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
