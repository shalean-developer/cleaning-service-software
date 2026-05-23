import { WIZARD_SERVICE_OPTIONS } from "@/features/booking-wizard/constants";
import { getAddonStepLabel } from "@/features/booking-wizard/addonStepDisplay";
import { EQUIPMENT_SUPPLY_STEP_OPTIONS, TEAM_SUPPORT_STEP_OPTIONS } from "@/features/booking-wizard/constants";
import { deriveOfficePropertySizeSqm } from "@/features/booking-wizard/officeSizing";
import { isOfficeCleaningSlug } from "@/features/booking-wizard/officeCleaningDisplay";
import type { PricingBreakdown } from "@/features/pricing/server/types";
import { formatAdminQuoteZar } from "./pricingApi";
import type { AdminBookingWizardFormState } from "./draftFormState";
import { composeAdminLocationNotes, composeAdminSpecialInstructions } from "./adminAddressCompose";
import {
  formatAdminFrequencyDisplayLabel,
  formatAdminRecurringScheduleSummary,
} from "./adminRecurringSchedule";

function serviceLabel(slug: string): string {
  return WIZARD_SERVICE_OPTIONS.find((opt) => opt.slug === slug)?.label ?? slug;
}

export function formatAdminBookingSummaryExtras(form: AdminBookingWizardFormState): string {
  if (!form.serviceSlug) return "None";

  const parts: string[] = [];
  if (form.addons.length > 0) {
    parts.push(
      form.addons
        .map((slug) => getAddonStepLabel(slug, form.serviceSlug || null))
        .join(", "),
    );
  }
  if (form.serviceSlug === "regular-cleaning") {
    parts.push(`Intensity: ${form.cleaningIntensity}`);
    const equipment = EQUIPMENT_SUPPLY_STEP_OPTIONS.find((o) => o.value === form.equipmentSupply);
    if (equipment) parts.push(equipment.label);
    const team = TEAM_SUPPORT_STEP_OPTIONS.find((o) => o.value === form.requestedTeamSize);
    if (team && form.requestedTeamSize === 2) parts.push(team.label);
    if (form.extraRooms > 0) parts.push(`${form.extraRooms} extra room(s)`);
  }
  if (isOfficeCleaningSlug(form.serviceSlug)) {
    const sqm = deriveOfficePropertySizeSqm(form.officeSizeTier, form.officeWorkstations);
    if (sqm) parts.push(`~${sqm} sqm office`);
  }
  if (form.serviceSlug === "carpet-cleaning") {
    if (form.carpetStainSeverity) parts.push(`Stains: ${form.carpetStainSeverity}`);
    if (form.carpetPetStains) parts.push("Pet stains");
  }

  return parts.length > 0 ? parts.join(" · ") : "None";
}

export function buildAdminBookingSummaryLabels(
  form: AdminBookingWizardFormState,
  quote: PricingBreakdown | null,
) {
  const locationNotes = composeAdminLocationNotes(form);
  const specialInstructions = composeAdminSpecialInstructions(form);

  const recurringScheduleLabel = formatAdminRecurringScheduleSummary({
    frequency: form.frequency,
    recurringDays: form.recurringDays,
    recurringIntervalWeeks: form.recurringIntervalWeeks,
    time: form.time,
  });

  return {
    customerLabel: form.selectedCustomer?.label ?? "Not selected",
    serviceLabel: form.serviceSlug ? serviceLabel(form.serviceSlug) : "Not selected",
    scheduleLabel: form.date && form.time ? `${form.date} · ${form.time}` : "Not scheduled",
    addressLabel:
      form.addressLine1 && form.suburb
        ? `${form.addressLine1}, ${form.suburb}${form.city ? `, ${form.city}` : ""}`
        : "Not entered",
    extrasLabel: formatAdminBookingSummaryExtras(form),
    accessNotesLabel: locationNotes || "None",
    specialInstructionsLabel: specialInstructions || "None",
    totalLabel: quote ? formatAdminQuoteZar(quote.totalCents) : "Select service for quote",
    frequencyLabel: formatAdminFrequencyDisplayLabel(
      form.frequency,
      form.recurringIntervalWeeks,
    ),
    recurringScheduleLabel: recurringScheduleLabel ?? "—",
  };
}
