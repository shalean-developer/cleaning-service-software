"use client";

import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  PricingFrequency,
  ServiceSlug,
} from "@/features/pricing/server/types";
import {
  getHomeSizeSectionTitle,
  getHostNotesPlaceholder,
  getHostNotesSectionTitle,
} from "../airbnbCleaningDisplay";
import { EXTRA_ROOMS_VISIBLE_HINT } from "../detailsStepHints";
import {
  DETAILS_OPTION_ROW_CELL,
  DETAILS_OPTION_ROW_GRID,
  DETAILS_STEP_LABEL,
  DETAILS_STEP_SECTION,
  EXTRA_ROOMS_INFO_TEXT,
} from "../detailsStepUi";
import { inputClass } from "./Field";
import { WIZARD_KEYBOARD_SCROLL_MARGIN_CLASS } from "../wizardLayout";
import { AddonsStepPanel } from "./AddonsStepPanel";
import { CleaningIntensityStepPanel } from "./CleaningIntensityStepPanel";
import { DetailsLabelWithInfo } from "./DetailsFieldInfo";
import { DetailsQuantityStepper } from "./DetailsQuantityStepper";
import { DetailsSectionHeading } from "./DetailsSectionHeading";
import { DetailsStepIntro } from "./DetailsStepIntro";
import { EquipmentSupplyStepPanel } from "./EquipmentSupplyStepPanel";
import { FrequencyStepPanel } from "./FrequencyStepPanel";
import { TeamSupportStepPanel } from "./TeamSupportStepPanel";

type Props = {
  serviceSlug: ServiceSlug | null;
  bedrooms: number;
  bathrooms: number;
  extraRooms: number;
  propertySizeSqm: number | null;
  cleaningIntensity: CleaningIntensity;
  equipmentSupply: EquipmentSupply;
  requestedTeamSize: 1 | 2;
  frequency: PricingFrequency;
  addons: AddonSlug[];
  specialInstructions: string;
  stepErrors: Record<string, string>;
  onBedroomsChange: (bedrooms: number) => void;
  onBathroomsChange: (bathrooms: number) => void;
  onExtraRoomsChange: (extraRooms: number) => void;
  onPropertySizeSqmChange: (propertySizeSqm: number | null) => void;
  onCleaningIntensityChange: (cleaningIntensity: CleaningIntensity) => void;
  onEquipmentSupplyChange: (equipmentSupply: EquipmentSupply) => void;
  onRequestedTeamSizeChange: (requestedTeamSize: 1 | 2) => void;
  onFrequencyChange: (frequency: PricingFrequency) => void;
  onAddonsChange: (addons: AddonSlug[]) => void;
  onSpecialInstructionsChange: (specialInstructions: string) => void;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

export function DetailsStepPanel({
  serviceSlug,
  bedrooms,
  bathrooms,
  extraRooms,
  propertySizeSqm,
  cleaningIntensity,
  equipmentSupply,
  requestedTeamSize,
  frequency,
  addons,
  specialInstructions,
  stepErrors,
  onBedroomsChange,
  onBathroomsChange,
  onExtraRoomsChange,
  onPropertySizeSqmChange,
  onCleaningIntensityChange,
  onEquipmentSupplyChange,
  onRequestedTeamSizeChange,
  onFrequencyChange,
  onAddonsChange,
  onSpecialInstructionsChange,
}: Props) {
  const isOffice = serviceSlug === "office-cleaning";
  const isRegular = serviceSlug === "regular-cleaning";

  return (
    <div className="min-w-0">
      <DetailsStepIntro serviceSlug={serviceSlug} />

      <FrequencyStepPanel
        serviceSlug={serviceSlug}
        value={frequency}
        onChange={onFrequencyChange}
        error={stepErrors.frequency}
      />

      <section className={DETAILS_STEP_SECTION} aria-labelledby="details-home-size">
        <DetailsSectionHeading
          title={getHomeSizeSectionTitle(serviceSlug)}
          id="details-home-size"
        />

        {!isOffice ? (
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="min-w-0">
              <span className={DETAILS_STEP_LABEL}>Bedrooms</span>
              <DetailsQuantityStepper
                value={bedrooms}
                min={0}
                max={20}
                ariaLabel="bedrooms"
                onChange={onBedroomsChange}
              />
              <FieldError message={stepErrors.bedrooms} />
            </div>
            <div className="min-w-0">
              <span className={DETAILS_STEP_LABEL}>Bathrooms</span>
              <DetailsQuantityStepper
                value={bathrooms}
                min={0}
                max={20}
                ariaLabel="bathrooms"
                onChange={onBathroomsChange}
              />
              <FieldError message={stepErrors.bathrooms} />
            </div>
          </div>
        ) : (
          <div className="min-w-0 sm:max-w-xs">
            <label htmlFor="details-property-sqm" className={DETAILS_STEP_LABEL}>
              Property size (sqm)
            </label>
            <input
              id="details-property-sqm"
              type="number"
              min={1}
              className={inputClass}
              value={propertySizeSqm ?? ""}
              onChange={(e) =>
                onPropertySizeSqmChange(e.target.value ? Number(e.target.value) : null)
              }
            />
            <FieldError message={stepErrors.propertySizeSqm} />
          </div>
        )}
      </section>

      {isRegular ? (
        <CleaningIntensityStepPanel
          value={cleaningIntensity}
          onChange={onCleaningIntensityChange}
          error={stepErrors.cleaningIntensity}
        />
      ) : null}

      <AddonsStepPanel serviceSlug={serviceSlug} selected={addons} onChange={onAddonsChange} />

      {isRegular ? (
        <section className={DETAILS_STEP_SECTION} aria-labelledby="details-supplies-support">
          <DetailsSectionHeading title="Supplies & support" id="details-supplies-support" />
          <div className={DETAILS_OPTION_ROW_GRID}>
            <div className={DETAILS_OPTION_ROW_CELL}>
              <DetailsLabelWithInfo
                label="Extra rooms"
                infoText={EXTRA_ROOMS_INFO_TEXT}
                visibleHint={EXTRA_ROOMS_VISIBLE_HINT}
              />
              <DetailsQuantityStepper
                value={extraRooms}
                min={0}
                max={6}
                ariaLabel="extra rooms"
                onChange={onExtraRoomsChange}
              />
              <FieldError message={stepErrors.extraRooms} />
            </div>
            <div className={DETAILS_OPTION_ROW_CELL}>
              <EquipmentSupplyStepPanel
                value={equipmentSupply}
                onChange={onEquipmentSupplyChange}
                error={stepErrors.equipmentSupply}
              />
            </div>
            <div className={DETAILS_OPTION_ROW_CELL}>
              <TeamSupportStepPanel
                value={requestedTeamSize}
                onChange={onRequestedTeamSizeChange}
                error={stepErrors.requestedTeamSize}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className={DETAILS_STEP_SECTION} aria-labelledby="details-notes">
        <DetailsSectionHeading
          title={getHostNotesSectionTitle(serviceSlug)}
          id="details-notes"
        />
        <textarea
          id="details-special-instructions-input"
          className={`${inputClass} min-h-[4.5rem] resize-y ${WIZARD_KEYBOARD_SCROLL_MARGIN_CLASS}`}
          value={specialInstructions}
          onChange={(e) => onSpecialInstructionsChange(e.target.value)}
          placeholder={getHostNotesPlaceholder(serviceSlug)}
        />
      </section>
    </div>
  );
}
