import type { Json } from "@/lib/database/types";
import { resolveServiceSlugFromMetadata } from "./parseBookingDisplay";

export type TeamRequestFulfillment = {
  fulfilledCleanerCount: 1 | 2;
  recordedAt: string;
  recordedByProfileId: string;
};

/** NF-7B.2 — operational coordination visibility only (not lifecycle). */
export type TeamCoordinationStatus =
  | "awaiting_coordination"
  | "partially_fulfilled"
  | "fully_coordinated";

export type TeamCoordinationStatusRecord = {
  status: TeamCoordinationStatus;
  recordedAt: string;
  recordedByProfileId: string;
};

/** Supporting partner cleaner — ops metadata only, not a second assignee. */
export type SupportingCleanerRecord = {
  name?: string;
  profileId?: string;
  recordedAt: string;
  recordedByProfileId: string;
};

export type TeamSupportOps = {
  supportingCleaner: SupportingCleanerRecord | null;
  teamSupportNotes: string | null;
  coordinationStatus: TeamCoordinationStatusRecord | null;
};

export type AdminOperationalLoadSignals = {
  isTwoCleanerRequest: boolean;
  isShaleanEquipment: boolean;
  isHeavyIntensity: boolean;
  operationalLoadScore: number;
};

export type AdminOperationalLoadBadge = {
  label: string;
  tone: "neutral" | "info" | "warning";
};

const ADMIN_OPS_METADATA_KEY = "adminOps";
const TEAM_FULFILLMENT_KEY = "teamRequestFulfillment";
const SUPPORTING_CLEANER_KEY = "supportingCleaner";
const TEAM_SUPPORT_NOTES_KEY = "teamSupportNotes";
const TEAM_COORDINATION_STATUS_KEY = "teamCoordinationStatus";

function asRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function resolveInputRecord(record: Record<string, unknown>): Record<string, unknown> {
  const quote = record.quote;
  if (quote != null && typeof quote === "object" && !Array.isArray(quote)) {
    const quoteRecord = quote as Record<string, unknown>;
    const input = quoteRecord.input;
    if (input != null && typeof input === "object" && !Array.isArray(input)) {
      return { ...record, ...(input as Record<string, unknown>) };
    }
  }
  return record;
}

function readCleaningIntensityRaw(merged: Record<string, unknown>): string {
  return typeof merged.cleaningIntensity === "string" ? merged.cleaningIntensity : "standard";
}

function readEquipmentSupplyRaw(merged: Record<string, unknown>): string {
  return typeof merged.equipmentSupply === "string" ? merged.equipmentSupply : "customer";
}

function readRequestedTeamSizeRaw(merged: Record<string, unknown>): 1 | 2 {
  return merged.requestedTeamSize === 2 ? 2 : 1;
}

function readHomeSizeUnits(merged: Record<string, unknown>): number | null {
  const bedrooms = typeof merged.bedrooms === "number" ? merged.bedrooms : null;
  const bathrooms = typeof merged.bathrooms === "number" ? merged.bathrooms : null;
  if (bedrooms == null || bathrooms == null) return null;
  return bedrooms + bathrooms;
}

/** Display-only operational load from booking metadata (no assignment logic). */
export function parseAdminOperationalLoadSignals(
  metadata: Json | null | undefined,
  serviceSlug: string | null,
): AdminOperationalLoadSignals {
  const slug = serviceSlug ?? resolveServiceSlugFromMetadata(metadata);
  if (slug !== "regular-cleaning") {
    return {
      isTwoCleanerRequest: false,
      isShaleanEquipment: false,
      isHeavyIntensity: false,
      operationalLoadScore: 0,
    };
  }

  const merged = resolveInputRecord(asRecord(metadata));
  const isTwoCleanerRequest = readRequestedTeamSizeRaw(merged) === 2;
  const isShaleanEquipment = readEquipmentSupplyRaw(merged) === "shalean";
  const isHeavyIntensity = readCleaningIntensityRaw(merged) === "heavy";

  let operationalLoadScore = 0;
  if (isTwoCleanerRequest) operationalLoadScore += 2;
  if (isShaleanEquipment) operationalLoadScore += 1;
  if (isHeavyIntensity) operationalLoadScore += 1;

  return {
    isTwoCleanerRequest,
    isShaleanEquipment,
    isHeavyIntensity,
    operationalLoadScore,
  };
}

export function buildAdminOperationalLoadBadges(
  signals: AdminOperationalLoadSignals,
): AdminOperationalLoadBadge[] {
  const badges: AdminOperationalLoadBadge[] = [];
  if (signals.isTwoCleanerRequest) {
    badges.push({ label: "2-cleaner request", tone: "info" });
  }
  if (signals.isShaleanEquipment) {
    badges.push({ label: "Bring equipment", tone: "warning" });
  }
  if (signals.isHeavyIntensity) {
    badges.push({ label: "Heavy clean", tone: "warning" });
  }
  if (signals.operationalLoadScore >= 3) {
    badges.push({ label: "Operational load", tone: "warning" });
  }
  return badges;
}

export function readTeamRequestFulfillment(
  metadata: Json | null | undefined,
): TeamRequestFulfillment | null {
  const adminOps = asRecord(asRecord(metadata)[ADMIN_OPS_METADATA_KEY] as Json);
  const raw = asRecord(adminOps[TEAM_FULFILLMENT_KEY] as Json);
  const count = raw.fulfilledCleanerCount;
  const recordedAt = raw.recordedAt;
  const recordedByProfileId = raw.recordedByProfileId;
  if (count !== 1 && count !== 2) return null;
  if (typeof recordedAt !== "string" || recordedAt.length === 0) return null;
  if (typeof recordedByProfileId !== "string" || recordedByProfileId.length === 0) {
    return null;
  }
  return {
    fulfilledCleanerCount: count,
    recordedAt,
    recordedByProfileId,
  };
}

export function mergeTeamRequestFulfillmentMetadata(
  metadata: Json | null | undefined,
  fulfillment: TeamRequestFulfillment,
): Json {
  return mergeAdminOpsMetadata(metadata, { [TEAM_FULFILLMENT_KEY]: fulfillment });
}

function mergeAdminOpsMetadata(
  metadata: Json | null | undefined,
  adminOpsPatch: Record<string, unknown>,
): Json {
  const record = asRecord(metadata);
  const adminOps = asRecord(record[ADMIN_OPS_METADATA_KEY] as Json);
  return {
    ...record,
    [ADMIN_OPS_METADATA_KEY]: {
      ...adminOps,
      ...adminOpsPatch,
    },
  } as Json;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readSupportingCleaner(
  metadata: Json | null | undefined,
): SupportingCleanerRecord | null {
  const adminOps = asRecord(asRecord(metadata)[ADMIN_OPS_METADATA_KEY] as Json);
  const raw = asRecord(adminOps[SUPPORTING_CLEANER_KEY] as Json);
  const name = readNonEmptyString(raw.name);
  const profileId = readNonEmptyString(raw.profileId);
  const recordedAt = raw.recordedAt;
  const recordedByProfileId = raw.recordedByProfileId;
  if (!name && !profileId) return null;
  if (typeof recordedAt !== "string" || recordedAt.length === 0) return null;
  if (typeof recordedByProfileId !== "string" || recordedByProfileId.length === 0) {
    return null;
  }
  return {
    ...(name ? { name } : {}),
    ...(profileId ? { profileId } : {}),
    recordedAt,
    recordedByProfileId,
  };
}

export function readTeamSupportNotes(metadata: Json | null | undefined): string | null {
  const adminOps = asRecord(asRecord(metadata)[ADMIN_OPS_METADATA_KEY] as Json);
  return readNonEmptyString(adminOps[TEAM_SUPPORT_NOTES_KEY]);
}

export function readTeamCoordinationStatus(
  metadata: Json | null | undefined,
): TeamCoordinationStatusRecord | null {
  const adminOps = asRecord(asRecord(metadata)[ADMIN_OPS_METADATA_KEY] as Json);
  const raw = asRecord(adminOps[TEAM_COORDINATION_STATUS_KEY] as Json);
  const status = raw.status;
  const recordedAt = raw.recordedAt;
  const recordedByProfileId = raw.recordedByProfileId;
  if (
    status !== "awaiting_coordination" &&
    status !== "partially_fulfilled" &&
    status !== "fully_coordinated"
  ) {
    return null;
  }
  if (typeof recordedAt !== "string" || recordedAt.length === 0) return null;
  if (typeof recordedByProfileId !== "string" || recordedByProfileId.length === 0) {
    return null;
  }
  return { status, recordedAt, recordedByProfileId };
}

export function readTeamSupportOps(metadata: Json | null | undefined): TeamSupportOps {
  return {
    supportingCleaner: readSupportingCleaner(metadata),
    teamSupportNotes: readTeamSupportNotes(metadata),
    coordinationStatus: readTeamCoordinationStatus(metadata),
  };
}

export type TeamSupportOpsMetadataPatch = {
  supportingCleaner?: SupportingCleanerRecord | null;
  teamSupportNotes?: string | null;
  coordinationStatus?: TeamCoordinationStatusRecord | null;
};

export function mergeTeamSupportOpsMetadata(
  metadata: Json | null | undefined,
  patch: TeamSupportOpsMetadataPatch,
): Json {
  const record = asRecord(metadata);
  const adminOps = { ...asRecord(record[ADMIN_OPS_METADATA_KEY] as Json) };

  if ("supportingCleaner" in patch) {
    if (patch.supportingCleaner == null) {
      delete adminOps[SUPPORTING_CLEANER_KEY];
    } else {
      adminOps[SUPPORTING_CLEANER_KEY] = patch.supportingCleaner;
    }
  }
  if ("teamSupportNotes" in patch) {
    const notes = patch.teamSupportNotes;
    if (notes == null || readNonEmptyString(notes) == null) {
      delete adminOps[TEAM_SUPPORT_NOTES_KEY];
    } else {
      adminOps[TEAM_SUPPORT_NOTES_KEY] = readNonEmptyString(notes);
    }
  }
  if ("coordinationStatus" in patch) {
    if (patch.coordinationStatus == null) {
      delete adminOps[TEAM_COORDINATION_STATUS_KEY];
    } else {
      adminOps[TEAM_COORDINATION_STATUS_KEY] = patch.coordinationStatus;
    }
  }

  return {
    ...record,
    [ADMIN_OPS_METADATA_KEY]: adminOps,
  } as Json;
}

export function supportingCleanerDisplayLabel(
  record: SupportingCleanerRecord | null,
): string | null {
  if (!record) return null;
  if (record.name && record.profileId) {
    return `${record.name} (${record.profileId.slice(0, 8)})`;
  }
  return record.name ?? record.profileId ?? null;
}

export function teamCoordinationStatusLabel(
  record: TeamCoordinationStatusRecord | null,
  isTwoCleanerRequest: boolean,
): string | null {
  if (!isTwoCleanerRequest) return null;
  if (!record) return "Coordination not recorded";
  switch (record.status) {
    case "awaiting_coordination":
      return "Awaiting coordination";
    case "partially_fulfilled":
      return "Partially coordinated";
    case "fully_coordinated":
      return "Fully coordinated";
    default:
      return null;
  }
}

export type TeamSupportObservationRow = {
  bookingId: string;
  priceCents: number;
  serviceSlug: string | null;
  isRegularCleaning: boolean;
  isTwoCleanerRequest: boolean;
  homeSizeUnits: number | null;
  operationalLoad: AdminOperationalLoadSignals;
  teamRequestFulfillment: TeamRequestFulfillment | null;
  teamSupportOps: TeamSupportOps;
  supportingCleanerLabel: string | null;
  coordinationStatusLabel: string | null;
  hasTeamSupportNotes: boolean;
};

export function mapTeamSupportObservationRow(input: {
  bookingId: string;
  priceCents: number;
  metadata: Json | null | undefined;
}): TeamSupportObservationRow {
  const serviceSlug = resolveServiceSlugFromMetadata(input.metadata);
  const isRegularCleaning = serviceSlug === "regular-cleaning";
  const operationalLoad = parseAdminOperationalLoadSignals(input.metadata, serviceSlug);
  const merged = resolveInputRecord(asRecord(input.metadata));

  const isTwoCleanerRequest = isRegularCleaning && operationalLoad.isTwoCleanerRequest;
  const teamSupportOps = readTeamSupportOps(input.metadata);

  return {
    bookingId: input.bookingId,
    priceCents: input.priceCents,
    serviceSlug,
    isRegularCleaning,
    isTwoCleanerRequest,
    homeSizeUnits: isRegularCleaning ? readHomeSizeUnits(merged) : null,
    operationalLoad,
    teamRequestFulfillment: readTeamRequestFulfillment(input.metadata),
    teamSupportOps,
    supportingCleanerLabel: supportingCleanerDisplayLabel(teamSupportOps.supportingCleaner),
    coordinationStatusLabel: teamCoordinationStatusLabel(
      teamSupportOps.coordinationStatus,
      isTwoCleanerRequest,
    ),
    hasTeamSupportNotes: teamSupportOps.teamSupportNotes != null,
  };
}

export type AdminTeamSupportAnalytics = {
  sampleLimit: number;
  sampleSize: number;
  regularCleaningTotal: number;
  teamRequestTotal: number;
  teamRequestPercent: number | null;
  fulfillmentRecorded: number;
  fulfillmentTwoCleaners: number;
  fulfillmentOneCleaner: number;
  fulfillmentUnrecorded: number;
  avgHomeSizeUnitsTeamRequests: number | null;
  avgPriceCentsTeamRequests: number | null;
  avgHomeSizeUnitsRegularCleaning: number | null;
  avgPriceCentsRegularCleaning: number | null;
  operationalLoadHighCount: number;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function computeAdminTeamSupportAnalytics(
  rows: TeamSupportObservationRow[],
  sampleLimit: number,
): AdminTeamSupportAnalytics {
  const regular = rows.filter((r) => r.isRegularCleaning);
  const teamRequests = regular.filter((r) => r.isTwoCleanerRequest);

  const fulfillmentRecorded = teamRequests.filter((r) => r.teamRequestFulfillment != null);
  const fulfillmentTwo = fulfillmentRecorded.filter(
    (r) => r.teamRequestFulfillment?.fulfilledCleanerCount === 2,
  );
  const fulfillmentOne = fulfillmentRecorded.filter(
    (r) => r.teamRequestFulfillment?.fulfilledCleanerCount === 1,
  );

  const teamHomeSizes = teamRequests
    .map((r) => r.homeSizeUnits)
    .filter((v): v is number => v != null);
  const teamPrices = teamRequests.map((r) => r.priceCents);
  const regularHomeSizes = regular
    .map((r) => r.homeSizeUnits)
    .filter((v): v is number => v != null);
  const regularPrices = regular.map((r) => r.priceCents);

  return {
    sampleLimit,
    sampleSize: rows.length,
    regularCleaningTotal: regular.length,
    teamRequestTotal: teamRequests.length,
    teamRequestPercent:
      regular.length > 0 ? (teamRequests.length / regular.length) * 100 : null,
    fulfillmentRecorded: fulfillmentRecorded.length,
    fulfillmentTwoCleaners: fulfillmentTwo.length,
    fulfillmentOneCleaner: fulfillmentOne.length,
    fulfillmentUnrecorded: teamRequests.length - fulfillmentRecorded.length,
    avgHomeSizeUnitsTeamRequests: average(teamHomeSizes),
    avgPriceCentsTeamRequests: average(teamPrices),
    avgHomeSizeUnitsRegularCleaning: average(regularHomeSizes),
    avgPriceCentsRegularCleaning: average(regularPrices),
    operationalLoadHighCount: regular.filter((r) => r.operationalLoad.operationalLoadScore >= 3)
      .length,
  };
}

export type TeamSupportBookingFilter =
  | "two_cleaner_request"
  | "operational_load"
  | "team_awaiting_coordination"
  | "team_fully_coordinated"
  | "high_operational_load"
  | "team_high_risk_combo";

/** In-memory filter for admin bookings list (NF-7B team support). */
export function matchesTeamSupportBookingFilter(
  row: Pick<
    TeamSupportObservationRow,
    "isTwoCleanerRequest" | "operationalLoad" | "teamSupportOps"
  >,
  filter: TeamSupportBookingFilter,
): boolean {
  switch (filter) {
    case "two_cleaner_request":
      return row.isTwoCleanerRequest;
    case "operational_load":
      return row.operationalLoad.operationalLoadScore >= 2;
    case "high_operational_load":
      return row.operationalLoad.operationalLoadScore >= 3;
    case "team_high_risk_combo":
      return (
        row.isTwoCleanerRequest &&
        row.operationalLoad.isShaleanEquipment &&
        row.operationalLoad.isHeavyIntensity
      );
    case "team_awaiting_coordination":
      if (!row.isTwoCleanerRequest) return false;
      return (
        row.teamSupportOps.coordinationStatus?.status === "awaiting_coordination" ||
        row.teamSupportOps.coordinationStatus == null
      );
    case "team_fully_coordinated":
      return (
        row.isTwoCleanerRequest &&
        row.teamSupportOps.coordinationStatus?.status === "fully_coordinated"
      );
    default:
      return false;
  }
}

/** Labels for admin display from parsed service details + fulfillment. */
export function teamRequestFulfillmentLabel(
  fulfillment: TeamRequestFulfillment | null,
  isTwoCleanerRequest: boolean,
): string | null {
  if (!isTwoCleanerRequest) return null;
  if (!fulfillment) return "Fulfillment not recorded";
  return fulfillment.fulfilledCleanerCount === 2
    ? "2 cleaners fulfilled (manual)"
    : "1 cleaner only (manual)";
}

export function formatTeamSupportAnalyticsHomeSize(units: number | null): string {
  if (units == null) return "—";
  return `${units.toFixed(1)} bed+bath units`;
}
