"use client";

import { DETAILS_INPUT, WIZARD_FOCUS_RING } from "../detailsStepUi";

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  ariaLabel: string;
};

const stepperButtonClass = `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-base font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 ${WIZARD_FOCUS_RING}`;

export function DetailsQuantityStepper({ value, min, max, onChange, ariaLabel }: Props) {
  return (
    <div
      className={`${DETAILS_INPUT} flex items-center justify-between gap-2 px-2 py-1.5`}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className={stepperButtonClass}
        aria-label={`Decrease ${ariaLabel}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span
        className="min-w-[2ch] flex-1 text-center text-sm font-semibold tabular-nums text-zinc-900"
        aria-live="polite"
        aria-atomic="true"
      >
        {value}
      </span>
      <button
        type="button"
        className={stepperButtonClass}
        aria-label={`Increase ${ariaLabel}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}
