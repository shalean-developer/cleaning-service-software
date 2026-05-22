"use client";

import { serviceSupportsExtraRooms } from "@/features/pricing/server/catalog";
import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  ServiceSlug,
} from "@/features/pricing/server/types";
import {
  getHomeSizeSectionTitle,
  getHostNotesPlaceholder,
  getHostNotesSectionTitle,
} from "../airbnbCleaningDisplay";
import {
  CARPET_ZONES_MAX,
  CARPET_ZONES_MIN,
  getCarpetCleaningStepCopy,
  isCarpetCleaningSlug,
} from "../carpetCleaningDisplay";
import type { CarpetStainSeverity } from "../carpetCleaningDisplay";
import { CarpetStainSeverityStepPanel } from "./CarpetStainSeverityStepPanel";
import { CarpetTogglesStepPanel } from "./CarpetTogglesStepPanel";
import { isOfficeCleaningSlug } from "../officeCleaningDisplay";
import type { OfficeSizeTier, OfficeWorkstationTier } from "../officeSizing";
import { OfficeSizingStepPanel } from "./OfficeSizingStepPanel";
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
import { TeamSupportStepPanel } from "./TeamSupportStepPanel";

type Props = {
  serviceSlug: ServiceSlug | null;
  bedrooms: number;
  bathrooms: number;
  extraRooms: number;
  propertySizeSqm: number | null;
  officeSizeTier: OfficeSizeTier | null;
  officeWorkstations: OfficeWorkstationTier | null;
  cleaningIntensity: CleaningIntensity;
  equipmentSupply: EquipmentSupply;
  requestedTeamSize: 1 | 2;
  addons: AddonSlug[];
  carpetStainSeverity: CarpetStainSeverity | null;
  carpetPetStains: boolean;
  carpetGoodDryingAirflow: boolean;
  specialInstructions: string;
  stepErrors: Record<string, string>;
  onBedroomsChange: (bedrooms: number) => void;
  onBathroomsChange: (bathrooms: number) => void;
  onExtraRoomsChange: (extraRooms: number) => void;
  onPropertySizeSqmChange: (propertySizeSqm: number | null) => void;
  onOfficeSizeChange: (tier: OfficeSizeTier) => void;
  onOfficeWorkstationsChange: (tier: OfficeWorkstationTier) => void;
  onCleaningIntensityChange: (cleaningIntensity: CleaningIntensity) => void;
  onEquipmentSupplyChange: (equipmentSupply: EquipmentSupply) => void;
  onRequestedTeamSizeChange: (requestedTeamSize: 1 | 2) => void;
  onAddonsChange: (addons: AddonSlug[]) => void;
  onCarpetStainSeverityChange: (severity: CarpetStainSeverity) => void;
  onCarpetPetStainsChange: (value: boolean) => void;
  onCarpetGoodDryingAirflowChange: (value: boolean) => void;
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

type ExtraRoomsFieldProps = {
  extraRooms: number;
  stepErrors: Record<string, string>;
  onExtraRoomsChange: (extraRooms: number) => void;
  /** When true, fills a home-size grid column (no standalone max-width). */
  inline?: boolean;
};

/** Shared extra-rooms stepper. same pattern as regular cleaning supplies row. */
function ExtraRoomsField({
  extraRooms,
  stepErrors,
  onExtraRoomsChange,
  inline = false,
}: ExtraRoomsFieldProps) {
  return (
    <div
      className={
        inline ? "flex h-full min-w-0 flex-col" : "min-w-0 sm:max-w-xs"
      }
    >
      <DetailsLabelWithInfo label="Extra rooms" infoText={EXTRA_ROOMS_INFO_TEXT} />
      <DetailsQuantityStepper
        value={extraRooms}
        min={0}
        max={6}
        ariaLabel="extra rooms"
        onChange={onExtraRoomsChange}
      />
      <FieldError message={stepErrors.extraRooms} />
    </div>
  );
}

export function DetailsStepPanel({
  serviceSlug,
  bedrooms,
  bathrooms,
  extraRooms,
  propertySizeSqm,
  officeSizeTier,
  officeWorkstations,
  cleaningIntensity,
  equipmentSupply,
  requestedTeamSize,
  addons,
  carpetStainSeverity,
  carpetPetStains,
  carpetGoodDryingAirflow,
  specialInstructions,
  stepErrors,
  onBedroomsChange,
  onBathroomsChange,
  onExtraRoomsChange,
  onPropertySizeSqmChange,
  onOfficeSizeChange,
  onOfficeWorkstationsChange,
  onCleaningIntensityChange,
  onEquipmentSupplyChange,
  onRequestedTeamSizeChange,
  onAddonsChange,
  onCarpetStainSeverityChange,
  onCarpetPetStainsChange,
  onCarpetGoodDryingAirflowChange,
  onSpecialInstructionsChange,
}: Props) {
  const isOffice = isOfficeCleaningSlug(serviceSlug);
  const carpetStep = getCarpetCleaningStepCopy(serviceSlug);
  const isCarpet = isCarpetCleaningSlug(serviceSlug);
  const isRegular = serviceSlug === "regular-cleaning";
  const showExtraRoomsNearHomeSize =
    serviceSlug != null && serviceSupportsExtraRooms(serviceSlug) && !isRegular;

  return (
    <div className="min-w-0">
      <DetailsStepIntro serviceSlug={serviceSlug} />

      {isOffice ? (
        <OfficeSizingStepPanel
          officeSizeTier={officeSizeTier}
          officeWorkstations={officeWorkstations}
          officeSizeError={stepErrors.officeSizeTier}
          officeWorkstationsError={stepErrors.officeWorkstations}
          onOfficeSizeChange={onOfficeSizeChange}
          onOfficeWorkstationsChange={onOfficeWorkstationsChange}
        />
      ) : (
      <section className={DETAILS_STEP_SECTION} aria-labelledby="details-home-size">
        <DetailsSectionHeading
          title={getHomeSizeSectionTitle(serviceSlug)}
          id="details-home-size"
        />

        {
          isCarpet && carpetStep ? (
            <div className="min-w-0 sm:max-w-xs">
              <span className={DETAILS_STEP_LABEL}>{carpetStep.zonesFieldLabel}</span>
              <p className="mb-1.5 text-xs leading-snug text-zinc-500">{carpetStep.zonesFieldHint}</p>
              <DetailsQuantityStepper
                value={bedrooms}
                min={CARPET_ZONES_MIN}
                max={CARPET_ZONES_MAX}
                ariaLabel={carpetStep.zonesAriaLabel}
                onChange={onBedroomsChange}
              />
              <FieldError message={stepErrors.bedrooms} />
            </div>
          ) : (
            <div
              className={
                showExtraRoomsNearHomeSize
                  ? "grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-3"
                  : "grid grid-cols-2 gap-3 sm:max-w-md"
              }
            >
              <div className="flex h-full min-w-0 flex-col">
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
              <div className="flex h-full min-w-0 flex-col">
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
              {showExtraRoomsNearHomeSize ? (
                <ExtraRoomsField
                  inline
                  extraRooms={extraRooms}
                  stepErrors={stepErrors}
                  onExtraRoomsChange={onExtraRoomsChange}
                />
              ) : null}
            </div>
          )}
      </section>
      )}

      {isRegular ? (
        <CleaningIntensityStepPanel
          value={cleaningIntensity}
          onChange={onCleaningIntensityChange}
          error={stepErrors.cleaningIntensity}
        />
      ) : null}

      {isCarpet ? (
        <>
          <CarpetStainSeverityStepPanel
            value={carpetStainSeverity}
            onChange={onCarpetStainSeverityChange}
          />
          <CarpetTogglesStepPanel
            petStains={carpetPetStains}
            goodDryingAirflow={carpetGoodDryingAirflow}
            onPetStainsChange={onCarpetPetStainsChange}
            onGoodDryingAirflowChange={onCarpetGoodDryingAirflowChange}
          />
        </>
      ) : null}

      <AddonsStepPanel serviceSlug={serviceSlug} selected={addons} onChange={onAddonsChange} />

      {isRegular ? (
        <section className={DETAILS_STEP_SECTION} aria-labelledby="details-supplies-support">
          <DetailsSectionHeading title="Supplies & support" id="details-supplies-support" />
          <div className={DETAILS_OPTION_ROW_GRID}>
            <div className={DETAILS_OPTION_ROW_CELL}>
              <ExtraRoomsField
                extraRooms={extraRooms}
                stepErrors={stepErrors}
                onExtraRoomsChange={onExtraRoomsChange}
              />
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
