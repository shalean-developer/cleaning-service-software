"use client";

import { DETAILS_OPTION_DESC, DETAILS_OPTION_TITLE, DETAILS_STEP_SECTION } from "../detailsStepUi";
import { DetailsSectionHeading } from "./DetailsSectionHeading";
import { DetailsToggleSwitch } from "./DetailsToggleSwitch";

type Props = {
  petStains: boolean;
  goodDryingAirflow: boolean;
  onPetStainsChange: (value: boolean) => void;
  onGoodDryingAirflowChange: (value: boolean) => void;
};

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex min-w-0 items-center gap-2 border-b border-zinc-100 px-2.5 py-2 last:border-b-0 sm:gap-2.5 sm:px-3">
      <div className="min-w-0 flex-1">
        <p className={DETAILS_OPTION_TITLE}>{label}</p>
        <p className={`${DETAILS_OPTION_DESC} line-clamp-2`}>{description}</p>
      </div>
      <DetailsToggleSwitch checked={checked} label={label} onToggle={onToggle} />
    </li>
  );
}

export function CarpetTogglesStepPanel({
  petStains,
  goodDryingAirflow,
  onPetStainsChange,
  onGoodDryingAirflowChange,
}: Props) {
  return (
    <section className={DETAILS_STEP_SECTION} aria-labelledby="carpet-toggles-label">
      <DetailsSectionHeading title="Carpet details" id="carpet-toggles-label" />

      <div
        className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm"
        role="group"
        aria-labelledby="carpet-toggles-label"
      >
        <ul className="m-0 grid list-none grid-cols-1 p-0">
          <ToggleRow
            label="Pet stains?"
            description="Helps us plan spotting time for pet-related marks."
            checked={petStains}
            onToggle={() => onPetStainsChange(!petStains)}
          />
          <ToggleRow
            label="Good drying airflow?"
            description="Ventilation and airflow affect drying after carpet cleaning."
            checked={goodDryingAirflow}
            onToggle={() => onGoodDryingAirflowChange(!goodDryingAirflow)}
          />
        </ul>
      </div>
    </section>
  );
}
