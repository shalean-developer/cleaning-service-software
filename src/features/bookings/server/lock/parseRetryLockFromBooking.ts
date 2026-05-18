import type { Json } from "@/lib/database/types";
import type { BookingRow } from "@/lib/database/types";
import { normalizeAreaSlug } from "@/features/cleaners/server/eligibility/normalize";
import {
  isAddonSlug,
  isCleaningIntensity,
  isEquipmentSupply,
  isPricingFrequency,
  isServiceSlug,
} from "@/features/pricing/server/catalog";
import type {
  AddonSlug,
  EquipmentSupply,
  PricingInput,
  PricingFrequency,
} from "@/features/pricing/server/types";
import type { CleanerPreferenceLock } from "./types";

function asRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

export type ParsedRetryLockContext =
  | {
      ok: true;
      pricingInput: PricingInput;
      areaSlug: string;
      cleanerPreference: CleanerPreferenceLock;
      bookingMetadata: Record<string, unknown>;
    }
  | { ok: false; message: string };

export function parseRetryLockFromBooking(booking: BookingRow): ParsedRetryLockContext {
  const metadata = asRecord(booking.metadata);
  const quote = metadata.quote;
  if (quote == null || typeof quote !== "object" || Array.isArray(quote)) {
    return { ok: false, message: "Booking is missing quote metadata for payment retry." };
  }

  const input = (quote as Record<string, unknown>).input;
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "Booking is missing quote.input metadata for payment retry." };
  }

  const inputRecord = input as Record<string, unknown>;
  const serviceSlugRaw =
    typeof inputRecord.serviceSlug === "string" ? inputRecord.serviceSlug : null;
  if (!serviceSlugRaw || !isServiceSlug(serviceSlugRaw)) {
    return { ok: false, message: "Booking quote metadata has an invalid service." };
  }

  const bedrooms = inputRecord.bedrooms;
  const bathrooms = inputRecord.bathrooms;
  if (typeof bedrooms !== "number" || typeof bathrooms !== "number") {
    return { ok: false, message: "Booking quote metadata is missing room counts." };
  }

  const frequencyRaw =
    typeof inputRecord.frequency === "string" ? inputRecord.frequency : "once";
  const frequency: PricingFrequency = isPricingFrequency(frequencyRaw)
    ? frequencyRaw
    : "once";

  const addons: AddonSlug[] = [];
  if (Array.isArray(inputRecord.addons)) {
    for (const a of inputRecord.addons) {
      if (typeof a === "string" && isAddonSlug(a)) addons.push(a);
    }
  }

  const suburb =
    typeof metadata.suburb === "string"
      ? metadata.suburb
      : typeof metadata.areaSlug === "string"
        ? metadata.areaSlug
        : "";
  const areaSlug = normalizeAreaSlug(suburb);
  if (!areaSlug) {
    return { ok: false, message: "Booking metadata is missing a valid service area." };
  }

  const modeRaw =
    typeof metadata.cleanerPreferenceMode === "string"
      ? metadata.cleanerPreferenceMode
      : "best_available";
  const selectedCleanerId =
    typeof metadata.preferred_cleaner_id === "string"
      ? metadata.preferred_cleaner_id
      : typeof metadata.selectedCleanerId === "string"
        ? metadata.selectedCleanerId
        : null;

  const extraRooms =
    typeof inputRecord.extraRooms === "number" ? inputRecord.extraRooms : 0;

  const cleaningIntensityRaw =
    typeof inputRecord.cleaningIntensity === "string"
      ? inputRecord.cleaningIntensity
      : "standard";
  const cleaningIntensity = isCleaningIntensity(cleaningIntensityRaw)
    ? cleaningIntensityRaw
    : "standard";

  const equipmentSupplyRaw =
    typeof inputRecord.equipmentSupply === "string" ? inputRecord.equipmentSupply : "customer";
  const equipmentSupply: EquipmentSupply = isEquipmentSupply(equipmentSupplyRaw)
    ? equipmentSupplyRaw
    : "customer";

  const pricingInput: PricingInput = {
    serviceSlug: serviceSlugRaw,
    bedrooms,
    bathrooms,
    extraRooms,
    cleaningIntensity:
      serviceSlugRaw === "regular-cleaning" ? cleaningIntensity : "standard",
    equipmentSupply:
      serviceSlugRaw === "regular-cleaning" ? equipmentSupply : "customer",
    propertySizeSqm:
      typeof inputRecord.propertySizeSqm === "number" ? inputRecord.propertySizeSqm : undefined,
    frequency,
    addons: addons.length > 0 ? addons : undefined,
    teamSize: 1,
    requestedTeamSize:
      typeof inputRecord.requestedTeamSize === "number" &&
      inputRecord.requestedTeamSize === 2
        ? 2
        : 1,
  };

  return {
    ok: true,
    pricingInput,
    areaSlug,
    cleanerPreference: {
      mode: modeRaw === "selected" ? "selected" : "best_available",
      selectedCleanerId: modeRaw === "selected" ? selectedCleanerId : null,
    },
    bookingMetadata: metadata,
  };
}
