"use client";

import type { EquipmentSupply } from "@/features/pricing/server/types";
import { equipmentSupplyVisibleHint } from "../detailsStepHints";
import { BRING_EQUIPMENT_INFO_TEXT, DETAILS_TOGGLE_CONTROL } from "../detailsStepUi";
import { DetailsLabelWithInfo } from "./DetailsFieldInfo";
import { DetailsToggleSwitch } from "./DetailsToggleSwitch";

type Props = {
  value: EquipmentSupply;
  onChange: (value: EquipmentSupply) => void;
  error?: string;
};

export function EquipmentSupplyStepPanel({ value, onChange, error }: Props) {
  const bringEquipment = value === "shalean";

  return (
    <div className="flex min-w-0 flex-col">
      <DetailsLabelWithInfo
        id="equipment-supply-step-label"
        label="Cleaning equipment"
        infoText={BRING_EQUIPMENT_INFO_TEXT}
        visibleHint={equipmentSupplyVisibleHint(value)}
      />

      <div
        className={DETAILS_TOGGLE_CONTROL}
        role="group"
        aria-labelledby="equipment-supply-step-label"
      >
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
