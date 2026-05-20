"use client";

import type { CarpetStainSeverity } from "../carpetCleaningDisplay";
import { CARPET_STAIN_SEVERITY_OPTIONS } from "../carpetCleaningDisplay";
import {
  DETAILS_STEP_SECTION,
  detailsCardClass,
  WIZARD_CARD_TRANSITION,
  WIZARD_FOCUS_RING,
} from "../detailsStepUi";
import { DetailsSectionHeading } from "./DetailsSectionHeading";

type Props = {
  value: CarpetStainSeverity | null;
  onChange: (value: CarpetStainSeverity) => void;
};

export function CarpetStainSeverityStepPanel({ value, onChange }: Props) {
  return (
    <section className={DETAILS_STEP_SECTION} aria-labelledby="carpet-stain-severity-label">
      <DetailsSectionHeading title="Stain severity" id="carpet-stain-severity-label" />

      <div
        className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3"
        role="radiogroup"
        aria-labelledby="carpet-stain-severity-label"
      >
        {CARPET_STAIN_SEVERITY_OPTIONS.map((option) => {
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
              <span className="block text-sm font-semibold leading-snug text-zinc-900">
                {option.label}
              </span>
              <span className="mt-0.5 block text-[11px] font-medium leading-snug text-zinc-500 sm:text-xs">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
