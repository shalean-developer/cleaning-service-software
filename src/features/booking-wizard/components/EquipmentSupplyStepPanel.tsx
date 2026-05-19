import type { EquipmentSupply } from "@/features/pricing/server/types";
import { DetailsToggleSwitch, DETAILS_TOGGLE_CONTROL_CARD } from "./DetailsToggleSwitch";

type Props = {
  value: EquipmentSupply;
  onChange: (value: EquipmentSupply) => void;
  error?: string;
};

export function EquipmentSupplyStepPanel({ value, onChange, error }: Props) {
  const bringEquipment = value === "shalean";

  return (
    <div className="flex min-w-0 flex-col">
      <span
        id="equipment-supply-step-label"
        className="mb-1 block text-sm font-medium text-zinc-800"
      >
        Cleaning equipment
      </span>

      <div
        className={DETAILS_TOGGLE_CONTROL_CARD}
        role="group"
        aria-labelledby="equipment-supply-step-label"
      >
        <span className="text-sm text-zinc-900">{bringEquipment ? "Yes" : "No"}</span>
        <DetailsToggleSwitch
          checked={bringEquipment}
          label="Bring cleaning equipment"
          onToggle={() => onChange(bringEquipment ? "customer" : "shalean")}
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
