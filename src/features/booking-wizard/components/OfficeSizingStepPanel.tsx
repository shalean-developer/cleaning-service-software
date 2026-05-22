"use client";

import {
  OFFICE_SIZE_OPTIONS,
  OFFICE_WORKSTATION_OPTIONS,
  type OfficeSizeTier,
  type OfficeWorkstationTier,
} from "../officeSizing";
import {
  DETAILS_STEP_HINT,
  DETAILS_STEP_SECTION,
  detailsCardClass,
  WIZARD_CARD_TRANSITION,
  WIZARD_FOCUS_RING,
} from "../detailsStepUi";
import { DetailsSectionHeading } from "./DetailsSectionHeading";

const OFFICE_SIZE_HINT = "We price workspaces differently from bedrooms.";
const OFFICE_WORKSTATION_HINT = "Desks or seats we should plan around.";

const WORKSTATION_CHIP_BASE =
  "inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border px-3 text-sm font-medium tabular-nums transition-colors duration-200 ease-out motion-reduce:transition-none";
const WORKSTATION_CHIP_SELECTED =
  "border-shalean-primary bg-shalean-primary text-white shadow-sm";
const WORKSTATION_CHIP_UNSELECTED =
  "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-shalean-soft-blue/30/80";

type Props = {
  officeSizeTier: OfficeSizeTier | null;
  officeWorkstations: OfficeWorkstationTier | null;
  officeSizeError?: string;
  officeWorkstationsError?: string;
  onOfficeSizeChange: (tier: OfficeSizeTier) => void;
  onOfficeWorkstationsChange: (tier: OfficeWorkstationTier) => void;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

export function OfficeSizingStepPanel({
  officeSizeTier,
  officeWorkstations,
  officeSizeError,
  officeWorkstationsError,
  onOfficeSizeChange,
  onOfficeWorkstationsChange,
}: Props) {
  return (
    <>
      <section className={DETAILS_STEP_SECTION} aria-labelledby="office-size-step-label">
        <DetailsSectionHeading title="Office size" id="office-size-step-label" />
        <p className={`${DETAILS_STEP_HINT} -mt-1 mb-2`}>{OFFICE_SIZE_HINT}</p>

        <div
          className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3"
          role="radiogroup"
          aria-labelledby="office-size-step-label"
        >
          {OFFICE_SIZE_OPTIONS.map((option) => {
            const selected = officeSizeTier === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onOfficeSizeChange(option.value)}
                className={`flex min-h-[4rem] min-w-0 flex-col justify-center rounded-xl border px-3 py-2.5 text-left ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${detailsCardClass(selected)}`}
              >
                <span className="block text-sm font-semibold leading-snug text-shalean-navy">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 sm:text-xs">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
        <FieldError message={officeSizeError} />
      </section>

      <section
        className={`${DETAILS_STEP_SECTION} mb-3`}
        aria-labelledby="office-workstations-step-label"
      >
        <DetailsSectionHeading
          title="Workstations (approx.)"
          id="office-workstations-step-label"
        />
        <p className={`${DETAILS_STEP_HINT} -mt-1 mb-2`}>{OFFICE_WORKSTATION_HINT}</p>

        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-labelledby="office-workstations-step-label"
        >
          {OFFICE_WORKSTATION_OPTIONS.map((option) => {
            const selected = officeWorkstations === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onOfficeWorkstationsChange(option.value)}
                className={`${WORKSTATION_CHIP_BASE} ${WIZARD_FOCUS_RING} ${
                  selected ? WORKSTATION_CHIP_SELECTED : WORKSTATION_CHIP_UNSELECTED
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <FieldError message={officeWorkstationsError} />
      </section>
    </>
  );
}
