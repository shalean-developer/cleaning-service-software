"use client";

import type { ServiceSlug } from "@/features/pricing/server/types";
import { DetailsStepPanel } from "@/features/booking-wizard/components/DetailsStepPanel";
import type { AdminBookingWizardFormState } from "../draftFormState";

type Props = {
  form: AdminBookingWizardFormState;
  onFormChange: (patch: Partial<AdminBookingWizardFormState>) => void;
};

export function AdminBookingWizardServiceDetailsSection({ form, onFormChange }: Props) {
  if (!form.serviceSlug) {
    return (
      <p className="text-sm text-slate-600" data-testid="admin-booking-service-details-empty">
        Select a service above to configure home size, extras, and pricing inputs.
      </p>
    );
  }

  const serviceSlug = form.serviceSlug as ServiceSlug;

  return (
    <div className="mt-4 border-t border-slate-100 pt-4" data-testid="admin-booking-service-details">
      <DetailsStepPanel
        serviceSlug={serviceSlug}
        bedrooms={form.bedrooms}
        bathrooms={form.bathrooms}
        extraRooms={form.extraRooms}
        propertySizeSqm={form.propertySizeSqm}
        officeSizeTier={form.officeSizeTier}
        officeWorkstations={form.officeWorkstations}
        cleaningIntensity={form.cleaningIntensity}
        equipmentSupply={form.equipmentSupply}
        requestedTeamSize={form.requestedTeamSize}
        addons={form.addons}
        carpetStainSeverity={form.carpetStainSeverity}
        carpetPetStains={form.carpetPetStains}
        carpetGoodDryingAirflow={form.carpetGoodDryingAirflow}
        specialInstructions={form.specialInstructions}
        stepErrors={{}}
        onBedroomsChange={(bedrooms) => onFormChange({ bedrooms })}
        onBathroomsChange={(bathrooms) => onFormChange({ bathrooms })}
        onExtraRoomsChange={(extraRooms) => onFormChange({ extraRooms })}
        onPropertySizeSqmChange={(propertySizeSqm) => onFormChange({ propertySizeSqm })}
        onOfficeSizeChange={(officeSizeTier) => onFormChange({ officeSizeTier })}
        onOfficeWorkstationsChange={(officeWorkstations) => onFormChange({ officeWorkstations })}
        onCleaningIntensityChange={(cleaningIntensity) => onFormChange({ cleaningIntensity })}
        onEquipmentSupplyChange={(equipmentSupply) => onFormChange({ equipmentSupply })}
        onRequestedTeamSizeChange={(requestedTeamSize) => onFormChange({ requestedTeamSize })}
        onAddonsChange={(addons) => onFormChange({ addons })}
        onCarpetStainSeverityChange={(carpetStainSeverity) => onFormChange({ carpetStainSeverity })}
        onCarpetPetStainsChange={(carpetPetStains) => onFormChange({ carpetPetStains })}
        onCarpetGoodDryingAirflowChange={(carpetGoodDryingAirflow) =>
          onFormChange({ carpetGoodDryingAirflow })
        }
        onSpecialInstructionsChange={(specialInstructions) => onFormChange({ specialInstructions })}
      />
    </div>
  );
}
