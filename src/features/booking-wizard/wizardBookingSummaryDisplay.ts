import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  PricingFrequency,
  ServiceSlug,
} from "@/features/pricing/server/types";
import { wizardStateToPricingInput } from "./buildMetadata";
import { formatDateLabel } from "./format";
import {
  formatCleanerPreference,
  formatCompactBedBathSummary,
  formatExtraRoomsSummary,
  formatSelectedAddons,
  getCleaningIntensityLabel,
  getFrequencyLabel,
  getTeamSupportReviewSummaryLabel,
} from "./reviewDisplay";
import type { CleanerPreferenceMode } from "./types";
import { INITIAL_WIZARD_STATE } from "./types";

export type WizardSummaryRow = {
  label: string;
  value: string;
};

export type WizardBookingSummarySnapshot = {
  service: string;
  when: string | null;
  home: string | null;
  /** Optional recap lines — shown in collapsed “More details”. */
  secondaryRows: WizardSummaryRow[];
  estimatedTotalCents: number | null;
};

export type WizardBookingSummaryInput = {
  serviceLabel: string;
  serviceSlug: ServiceSlug | null;
  date: string;
  time: string;
  suburb: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  extraRooms: number;
  propertySizeSqm: number | null;
  cleaningIntensity: CleaningIntensity;
  equipmentSupply: EquipmentSupply;
  requestedTeamSize: 1 | 2;
  frequency: PricingFrequency;
  addons: AddonSlug[];
  cleanerPreferenceMode?: CleanerPreferenceMode;
  selectedCleanerDisplayName?: string | null;
};

function pushRow(rows: WizardSummaryRow[], label: string, value: string | null | undefined) {
  if (!value?.trim()) return;
  rows.push({ label, value: value.trim() });
}

function buildSecondaryRows(input: WizardBookingSummaryInput): WizardSummaryRow[] {
  const rows: WizardSummaryRow[] = [];

  if (input.serviceSlug === "regular-cleaning") {
    pushRow(rows, "Frequency", getFrequencyLabel(input.frequency));

    const addonsLabel = formatSelectedAddons(input.addons, input.serviceSlug);
    if (addonsLabel !== "None") {
      pushRow(rows, "Add-ons", addonsLabel);
    }

    if (input.cleaningIntensity !== "standard") {
      pushRow(rows, "Intensity", getCleaningIntensityLabel(input.cleaningIntensity));
    }

    const extraRooms = formatExtraRoomsSummary(input.extraRooms);
    pushRow(rows, "Extra rooms", extraRooms);

    const teamSupport = getTeamSupportReviewSummaryLabel(input.requestedTeamSize);
    pushRow(rows, "Team", teamSupport);
  }

  if (input.cleanerPreferenceMode) {
    pushRow(
      rows,
      "Cleaner",
      formatCleanerPreference(
        input.cleanerPreferenceMode,
        input.selectedCleanerDisplayName ?? null,
      ),
    );
  }

  return rows;
}

/** Display-only recap for details/cleaner sidebar — does not mutate wizard quote state. */
export function buildWizardBookingSummarySnapshot(
  input: WizardBookingSummaryInput,
): WizardBookingSummarySnapshot {
  const when = formatDateLabel(input.date, input.time) || null;
  const home = formatCompactBedBathSummary(
    input.serviceSlug,
    input.bedrooms,
    input.bathrooms,
    input.propertySizeSqm,
  );

  return {
    service: input.serviceLabel.trim() || "—",
    when,
    home,
    secondaryRows: buildSecondaryRows(input),
    estimatedTotalCents: getWizardEstimatedTotalCents(input),
  };
}

/** Mirrors review pricing for sidebar display only — official quote still loads on review. */
export function getWizardEstimatedTotalCents(input: WizardBookingSummaryInput): number | null {
  if (!input.serviceSlug) return null;

  const pricingInput = wizardStateToPricingInput({
    ...INITIAL_WIZARD_STATE,
    serviceSlug: input.serviceSlug,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    extraRooms: input.extraRooms,
    cleaningIntensity: input.cleaningIntensity,
    equipmentSupply: input.equipmentSupply,
    requestedTeamSize: input.requestedTeamSize,
    propertySizeSqm: input.propertySizeSqm,
    frequency: input.frequency,
    addons: input.addons,
  });

  if (!pricingInput) return null;

  const quoteResult = calculateQuote(pricingInput);
  if (!quoteResult.ok) return null;

  return quoteResult.breakdown.totalCents;
}
