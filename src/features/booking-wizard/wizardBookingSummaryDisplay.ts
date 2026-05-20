import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  PricingFrequency,
  ServiceSlug,
} from "@/features/pricing/server/types";
import { wizardStateToPricingInput } from "./buildMetadata";
import {
  getWizardSummaryAddonsLabel,
  getWizardSummaryFrequencyLabel,
  getWizardSummaryLocationLabel,
  isAirbnbCleaningSlug,
} from "./airbnbCleaningDisplay";
import { isDeepCleaningSlug } from "./deepCleaningDisplay";
import { isCarpetCleaningSlug } from "./carpetCleaningDisplay";
import { isMovingCleaningSlug } from "./movingCleaningDisplay";
import { isOfficeCleaningSlug } from "./officeCleaningDisplay";
import { formatDateLabel } from "./format";
import { formatSuburbLocation } from "./reviewDisplay";
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

function isResidentialSummarySlug(serviceSlug: ServiceSlug | null): boolean {
  return (
    serviceSlug === "regular-cleaning" ||
    serviceSlug === "airbnb-cleaning" ||
    serviceSlug === "deep-cleaning" ||
    serviceSlug === "moving-cleaning" ||
    isCarpetCleaningSlug(serviceSlug)
  );
}

function showWorkspaceSummarySecondaryRows(serviceSlug: ServiceSlug | null): boolean {
  return isOfficeCleaningSlug(serviceSlug);
}

function buildSecondaryRows(input: WizardBookingSummaryInput): WizardSummaryRow[] {
  const rows: WizardSummaryRow[] = [];
  const showPropertyLocation =
    isAirbnbCleaningSlug(input.serviceSlug) ||
    isMovingCleaningSlug(input.serviceSlug) ||
    isDeepCleaningSlug(input.serviceSlug) ||
    isOfficeCleaningSlug(input.serviceSlug) ||
    isCarpetCleaningSlug(input.serviceSlug);

  if (showPropertyLocation) {
    const location = formatSuburbLocation(input.suburb, input.city);
    pushRow(rows, getWizardSummaryLocationLabel(input.serviceSlug), location);
  }

  if (isResidentialSummarySlug(input.serviceSlug) || showWorkspaceSummarySecondaryRows(input.serviceSlug)) {
    pushRow(
      rows,
      getWizardSummaryFrequencyLabel(input.serviceSlug),
      getFrequencyLabel(input.frequency, input.serviceSlug),
    );

    const addonsLabel = formatSelectedAddons(input.addons, input.serviceSlug);
    if (addonsLabel !== "None") {
      pushRow(rows, getWizardSummaryAddonsLabel(input.serviceSlug), addonsLabel);
    }
  }

  if (input.serviceSlug === "regular-cleaning") {
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

  const snapshot: WizardBookingSummarySnapshot = {
    service: input.serviceLabel.trim() || "—",
    when,
    home,
    secondaryRows: buildSecondaryRows(input),
    estimatedTotalCents: getWizardEstimatedTotalCents(input),
  };

  if (
    (isAirbnbCleaningSlug(input.serviceSlug) ||
      isMovingCleaningSlug(input.serviceSlug) ||
      isDeepCleaningSlug(input.serviceSlug) ||
      isOfficeCleaningSlug(input.serviceSlug) ||
      isCarpetCleaningSlug(input.serviceSlug)) &&
    snapshot.secondaryRows.length > 0
  ) {
    const locationRow = snapshot.secondaryRows.find(
      (r) => r.label === getWizardSummaryLocationLabel(input.serviceSlug),
    );
    const otherRows = snapshot.secondaryRows.filter((r) => r !== locationRow);
    snapshot.secondaryRows = locationRow ? [locationRow, ...otherRows] : otherRows;
  }

  return snapshot;
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
