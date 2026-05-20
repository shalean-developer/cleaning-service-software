import {
  formatBedroomBathroomSummary,
  formatExtraRoomsSummary,
  formatSelectedAddons,
  getCleaningIntensityLabel,
  getEquipmentSupplyCustomerLabel,
  getEquipmentSupplyOperationalLabel,
  getTeamSupportCleanerNote,
  getTeamSupportCustomerLabel,
} from "@/features/booking-wizard/reviewDisplay";
import type {
  AddonSlug,
  CleaningIntensity,
  EquipmentSupply,
  PricingFrequency,
} from "@/features/pricing/server/types";
import {
  isCleaningIntensity,
  isEquipmentSupply,
  isServiceSlug,
} from "@/features/pricing/server/catalog";
import { getFrequencyLabel } from "@/features/booking-wizard/airbnbCleaningDisplay";
import type { Json } from "@/lib/database/types";

export type CustomerBookingServiceDetails = {
  homeSizeSummary: string | null;
  cleaningIntensityLabel: string | null;
  equipmentSupplyLabel: string | null;
  equipmentSupplyOperationalLabel: string | null;
  frequencyLabel: string | null;
  addonsSummary: string | null;
  teamSupportLabel: string | null;
  teamSupportCleanerNote: string | null;
  isTwoCleanerRequest: boolean;
};

function asRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readFrequency(value: unknown): PricingFrequency | null {
  if (
    value === "once" ||
    value === "weekly" ||
    value === "biweekly" ||
    value === "monthly"
  ) {
    return value;
  }
  return null;
}

function readCleaningIntensity(value: unknown): CleaningIntensity {
  if (typeof value === "string" && isCleaningIntensity(value)) return value;
  return "standard";
}

function readEquipmentSupply(value: unknown): EquipmentSupply {
  if (typeof value === "string" && isEquipmentSupply(value)) return value;
  return "customer";
}

function readAddons(value: unknown): AddonSlug[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AddonSlug => typeof item === "string");
}

function readRequestedTeamSize(value: unknown): 1 | 2 {
  return value === 2 ? 2 : 1;
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

/** Display-only service details from booking metadata (no lifecycle logic). */
export function parseCustomerBookingServiceDetails(
  metadata: Json | null | undefined,
  serviceSlug: string | null,
): CustomerBookingServiceDetails {
  const merged = resolveInputRecord(asRecord(metadata));
  const slug = serviceSlug && isServiceSlug(serviceSlug) ? serviceSlug : null;

  const bedrooms = readNumber(merged.bedrooms);
  const bathrooms = readNumber(merged.bathrooms);
  const extraRooms = readNumber(merged.extraRooms) ?? 0;
  const propertySizeSqm = readNumber(merged.propertySizeSqm);
  const frequency = readFrequency(merged.frequency);
  const addons = readAddons(merged.addons);
  const cleaningIntensity = readCleaningIntensity(merged.cleaningIntensity);
  const equipmentSupply = readEquipmentSupply(merged.equipmentSupply);
  const requestedTeamSize = readRequestedTeamSize(merged.requestedTeamSize);

  let homeSizeSummary: string | null = null;
  let cleaningIntensityLabel: string | null = null;
  let equipmentSupplyLabel: string | null = null;
  let equipmentSupplyOperationalLabel: string | null = null;
  if (bedrooms != null && bathrooms != null) {
    const { bedroomsLabel, bathroomsLabel } = formatBedroomBathroomSummary(
      slug,
      bedrooms,
      bathrooms,
      propertySizeSqm,
    );
    const extraRoomsLabel = formatExtraRoomsSummary(extraRooms);
    const parts = [bedroomsLabel, bathroomsLabel, extraRoomsLabel].filter(Boolean);
    homeSizeSummary = parts.length > 0 ? parts.join(" · ") : null;
  }

  if (slug === "regular-cleaning" && cleaningIntensity !== "standard") {
    cleaningIntensityLabel = getCleaningIntensityLabel(cleaningIntensity);
  }

  let teamSupportLabel: string | null = null;
  let teamSupportCleanerNote: string | null = null;
  if (slug === "regular-cleaning") {
    equipmentSupplyLabel = getEquipmentSupplyCustomerLabel(equipmentSupply);
    equipmentSupplyOperationalLabel = getEquipmentSupplyOperationalLabel(equipmentSupply);
    teamSupportLabel = getTeamSupportCustomerLabel(requestedTeamSize);
    teamSupportCleanerNote = getTeamSupportCleanerNote(requestedTeamSize);
  }

  return {
    homeSizeSummary,
    cleaningIntensityLabel,
    equipmentSupplyLabel,
    equipmentSupplyOperationalLabel,
    frequencyLabel: frequency ? getFrequencyLabel(frequency, slug) : null,
    addonsSummary: addons.length > 0 ? formatSelectedAddons(addons, slug) : null,
    teamSupportLabel,
    teamSupportCleanerNote,
    isTwoCleanerRequest: slug === "regular-cleaning" && requestedTeamSize === 2,
  };
}
