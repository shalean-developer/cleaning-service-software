import type { PricingFrequency } from "@/features/pricing/server/types";
import { FREQUENCY_STEP_OPTIONS } from "../constants";
import {
  WIZARD_CARD_TRANSITION,
  WIZARD_FOCUS_RING,
  wizardCardClass,
} from "../wizardSelection";

type Props = {
  value: PricingFrequency;
  onChange: (value: PricingFrequency) => void;
  error?: string;
};

export function FrequencyStepPanel({ value, onChange, error }: Props) {
  return (
    <div className="mb-4 min-w-0">
      <span
        id="frequency-step-label"
        className="mb-2 block text-sm font-medium text-zinc-800"
      >
        Frequency
      </span>

      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
        role="radiogroup"
        aria-labelledby="frequency-step-label"
      >
        {FREQUENCY_STEP_OPTIONS.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`flex min-w-0 flex-col rounded-2xl border px-3 py-3 text-left sm:px-3.5 sm:py-3.5 ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${wizardCardClass(selected)}`}
            >
              <span className="block text-sm font-semibold leading-snug text-zinc-900">
                {option.label}
              </span>
              <span className="mt-1 block text-xs leading-snug text-zinc-500">
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
    </div>
  );
}
