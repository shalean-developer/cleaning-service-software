"use client";

import { DETAILS_TOGGLE_CONTROL, REQUEST_TWO_CLEANERS_INFO_TEXT } from "../detailsStepUi";
import { DetailsLabelWithInfo } from "./DetailsFieldInfo";
import { DetailsToggleSwitch } from "./DetailsToggleSwitch";

type Props = {
  value: 1 | 2;
  onChange: (value: 1 | 2) => void;
  error?: string;
};

export function TeamSupportStepPanel({ value, onChange, error }: Props) {
  const teamSupport = value === 2;

  return (
    <div className="flex min-w-0 flex-col">
      <DetailsLabelWithInfo
        id="team-support-step-label"
        label="Team support"
        infoText={REQUEST_TWO_CLEANERS_INFO_TEXT}
      />

      <div
        className={DETAILS_TOGGLE_CONTROL}
        role="group"
        aria-labelledby="team-support-step-label"
      >
        <DetailsToggleSwitch
          checked={teamSupport}
          label="Request team support"
          onToggle={() => onChange(teamSupport ? 1 : 2)}
        />
      </div>

      {error ? (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
