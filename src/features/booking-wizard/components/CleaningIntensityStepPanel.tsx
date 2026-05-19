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
        className="grid gap-2 sm:grid-cols-3 sm:gap-2.5"
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
              className={`flex min-w-0 flex-col rounded-xl border px-3 py-2.5 text-left ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${detailsCardClass(selected)}`}
            >
              <span className="block text-sm font-semibold leading-snug text-zinc-900">
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
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
