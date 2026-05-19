import { DetailsToggleSwitch, DETAILS_TOGGLE_CONTROL_CARD } from "./DetailsToggleSwitch";

type Props = {
  value: 1 | 2;
  onChange: (value: 1 | 2) => void;
  error?: string;
};

export function TeamSupportStepPanel({ value, onChange, error }: Props) {
  const teamSupport = value === 2;

  return (
    <div className="flex min-w-0 flex-col">
      <span id="team-support-step-label" className="mb-1 block text-sm font-medium text-zinc-800">
        Team support
      </span>

      <div
        className={DETAILS_TOGGLE_CONTROL_CARD}
        role="group"
        aria-labelledby="team-support-step-label"
      >
        <span className="text-sm text-zinc-900">{teamSupport ? "Yes" : "No"}</span>
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
