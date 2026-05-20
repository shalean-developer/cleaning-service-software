/**
 * Office cleaning size/workstation UI and sqm mapping — display + pricing bridge only.
 * Pricing engine still consumes `propertySizeSqm`; tiers derive that value.
 */

export const OFFICE_SIZE_TIERS = ["small", "medium", "large"] as const;
export type OfficeSizeTier = (typeof OFFICE_SIZE_TIERS)[number];

export const OFFICE_WORKSTATION_TIERS = ["5", "10", "15", "20", "30", "50_plus"] as const;
export type OfficeWorkstationTier = (typeof OFFICE_WORKSTATION_TIERS)[number];

export type OfficeSizeOption = {
  value: OfficeSizeTier;
  label: string;
  description: string;
};

export type OfficeWorkstationOption = {
  value: OfficeWorkstationTier;
  label: string;
};

export const OFFICE_SIZE_OPTIONS: OfficeSizeOption[] = [
  { value: "small", label: "Small office", description: "Studio / compact suite." },
  { value: "medium", label: "Medium office", description: "Several desks + shared areas." },
  { value: "large", label: "Large office", description: "Floorplate or multi-zone." },
];

export const OFFICE_WORKSTATION_OPTIONS: OfficeWorkstationOption[] = [
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "15", label: "15" },
  { value: "20", label: "20" },
  { value: "30", label: "30" },
  { value: "50_plus", label: "50+" },
];

/** Base sqm by office size tier — internal pricing bridge only. */
const OFFICE_SIZE_BASE_SQM: Record<OfficeSizeTier, number> = {
  small: 50,
  medium: 98,
  large: 145,
};

/** Additional sqm by workstation tier — internal pricing bridge only. */
const OFFICE_WORKSTATION_SQM: Record<OfficeWorkstationTier, number> = {
  "5": 0,
  "10": 10,
  "15": 22,
  "20": 35,
  "30": 55,
  "50_plus": 80,
};

export function isOfficeSizeTier(value: unknown): value is OfficeSizeTier {
  return typeof value === "string" && OFFICE_SIZE_TIERS.includes(value as OfficeSizeTier);
}

export function isOfficeWorkstationTier(value: unknown): value is OfficeWorkstationTier {
  return (
    typeof value === "string" &&
    OFFICE_WORKSTATION_TIERS.includes(value as OfficeWorkstationTier)
  );
}

/** Derives billable sqm input for the existing office pricing rule. */
export function deriveOfficePropertySizeSqm(
  officeSizeTier: OfficeSizeTier | null,
  officeWorkstations: OfficeWorkstationTier | null,
): number | null {
  if (!officeSizeTier || !officeWorkstations) return null;
  return OFFICE_SIZE_BASE_SQM[officeSizeTier] + OFFICE_WORKSTATION_SQM[officeWorkstations];
}

export function getOfficeSizeLabel(tier: OfficeSizeTier): string {
  return OFFICE_SIZE_OPTIONS.find((o) => o.value === tier)?.label ?? tier;
}

export function getOfficeWorkstationLabel(tier: OfficeWorkstationTier): string {
  return OFFICE_WORKSTATION_OPTIONS.find((o) => o.value === tier)?.label ?? tier;
}

export function formatOfficeWorkstationHeroSegment(tier: OfficeWorkstationTier): string {
  const desks = getOfficeWorkstationLabel(tier);
  return tier === "50_plus" ? "50+ workstations" : `${desks} workstations`;
}

/** Customer-facing summary — no sqm unless tiers missing (legacy). */
export function formatOfficeSizingSummary(
  officeSizeTier: OfficeSizeTier | null,
  officeWorkstations: OfficeWorkstationTier | null,
  propertySizeSqm: number | null = null,
): string | null {
  if (officeSizeTier && officeWorkstations) {
    const size = getOfficeSizeLabel(officeSizeTier);
    return `${size} · ${formatOfficeWorkstationHeroSegment(officeWorkstations)}`;
  }
  if (propertySizeSqm != null) return `${propertySizeSqm} sqm`;
  return null;
}

/** Best-effort restore tiers from persisted sqm (localStorage / legacy bookings). */
export function inferOfficeSizingFromPropertySizeSqm(
  propertySizeSqm: number | null,
): {
  officeSizeTier: OfficeSizeTier | null;
  officeWorkstations: OfficeWorkstationTier | null;
} {
  if (propertySizeSqm == null || !Number.isFinite(propertySizeSqm) || propertySizeSqm <= 0) {
    return { officeSizeTier: null, officeWorkstations: null };
  }

  let bestSize: OfficeSizeTier | null = null;
  let bestWorkstations: OfficeWorkstationTier | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const officeSizeTier of OFFICE_SIZE_TIERS) {
    for (const officeWorkstations of OFFICE_WORKSTATION_TIERS) {
      const derived = deriveOfficePropertySizeSqm(officeSizeTier, officeWorkstations);
      if (derived == null) continue;
      const delta = Math.abs(derived - propertySizeSqm);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestSize = officeSizeTier;
        bestWorkstations = officeWorkstations;
      }
    }
  }

  return { officeSizeTier: bestSize, officeWorkstations: bestWorkstations };
}

export function patchOfficeSizing(
  partial: {
    officeSizeTier?: OfficeSizeTier | null;
    officeWorkstations?: OfficeWorkstationTier | null;
  },
  current: {
    officeSizeTier: OfficeSizeTier | null;
    officeWorkstations: OfficeWorkstationTier | null;
  },
): {
  officeSizeTier: OfficeSizeTier | null;
  officeWorkstations: OfficeWorkstationTier | null;
  propertySizeSqm: number | null;
} {
  const officeSizeTier =
    partial.officeSizeTier !== undefined ? partial.officeSizeTier : current.officeSizeTier;
  const officeWorkstations =
    partial.officeWorkstations !== undefined
      ? partial.officeWorkstations
      : current.officeWorkstations;

  return {
    officeSizeTier,
    officeWorkstations,
    propertySizeSqm: deriveOfficePropertySizeSqm(officeSizeTier, officeWorkstations),
  };
}
