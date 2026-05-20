import {
  ADDON_SLUGS,
  PRICING_FREQUENCIES,
  SERVICE_SLUGS,
  type PricingInput,
  type PricingQuoteFailure,
} from "./types";
import {
  isAddonSlug,
  isCleaningIntensity,
  isEquipmentSupply,
  isPricingFrequency,
  isServiceSlug,
  SERVICE_CATALOG,
  serviceSupportsExtraRooms,
} from "./catalog";
import { CLEANING_INTENSITIES, EQUIPMENT_SUPPLY_OPTIONS } from "./types";

const MAX_ROOMS = 20;
const MAX_EXTRA_ROOMS = 6;
const MAX_TEAM_SIZE = 10;
const MAX_PROPERTY_SQ_M = 10_000;

function fail(
  code: PricingQuoteFailure["code"],
  message: string,
): PricingQuoteFailure {
  return { ok: false, code, message };
}

function isNonNegativeInteger(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

export function validatePricingInput(raw: PricingInput): PricingQuoteFailure | null {
  if (!isServiceSlug(raw.serviceSlug)) {
    return fail(
      "UNKNOWN_SERVICE",
      `Unknown service "${String(raw.serviceSlug)}". Expected one of: ${SERVICE_SLUGS.join(", ")}.`,
    );
  }

  const rule = SERVICE_CATALOG[raw.serviceSlug];

  if (!Number.isInteger(raw.bedrooms) || raw.bedrooms < 0 || raw.bedrooms > MAX_ROOMS) {
    return fail(
      "INVALID_BEDROOMS",
      `bedrooms must be an integer between 0 and ${MAX_ROOMS}.`,
    );
  }

  if (!Number.isInteger(raw.bathrooms) || raw.bathrooms < 0 || raw.bathrooms > MAX_ROOMS) {
    return fail(
      "INVALID_BATHROOMS",
      `bathrooms must be an integer between 0 and ${MAX_ROOMS}.`,
    );
  }

  if (!rule.allowZeroRooms) {
    if (raw.bedrooms < 1) {
      return fail("INVALID_BEDROOMS", "bedrooms must be at least 1 for this service.");
    }
    if (raw.bathrooms < 1) {
      return fail("INVALID_BATHROOMS", "bathrooms must be at least 1 for this service.");
    }
  }

  const extraRooms = raw.extraRooms ?? 0;
  if (!Number.isInteger(extraRooms) || extraRooms < 0 || extraRooms > MAX_EXTRA_ROOMS) {
    return fail(
      "INVALID_EXTRA_ROOMS",
      `extraRooms must be an integer between 0 and ${MAX_EXTRA_ROOMS}.`,
    );
  }
  if (!serviceSupportsExtraRooms(raw.serviceSlug) && extraRooms > 0) {
    return fail(
      "INVALID_EXTRA_ROOMS",
      "Extra rooms are not available for this service.",
    );
  }

  const cleaningIntensity = raw.cleaningIntensity ?? "standard";
  if (!isCleaningIntensity(cleaningIntensity)) {
    return fail(
      "INVALID_CLEANING_INTENSITY",
      `cleaningIntensity must be one of: ${CLEANING_INTENSITIES.join(", ")}.`,
    );
  }
  if (raw.serviceSlug !== "regular-cleaning" && cleaningIntensity !== "standard") {
    return fail(
      "INVALID_CLEANING_INTENSITY",
      "Cleaning intensity is only available for regular cleaning.",
    );
  }

  const equipmentSupply = raw.equipmentSupply ?? "customer";
  if (!isEquipmentSupply(equipmentSupply)) {
    return fail(
      "INVALID_EQUIPMENT_SUPPLY",
      `equipmentSupply must be one of: ${EQUIPMENT_SUPPLY_OPTIONS.join(", ")}.`,
    );
  }
  if (raw.serviceSlug !== "regular-cleaning" && equipmentSupply !== "customer") {
    return fail(
      "INVALID_EQUIPMENT_SUPPLY",
      "Equipment supply option is only available for regular cleaning.",
    );
  }

  if (raw.propertySizeSqm != null) {
    if (
      typeof raw.propertySizeSqm !== "number" ||
      !Number.isFinite(raw.propertySizeSqm) ||
      raw.propertySizeSqm < 0 ||
      raw.propertySizeSqm > MAX_PROPERTY_SQ_M
    ) {
      return fail(
        "INVALID_PROPERTY_SIZE",
        `propertySizeSqm must be a number between 0 and ${MAX_PROPERTY_SQ_M}.`,
      );
    }
  }

  const frequency = raw.frequency ?? "once";
  if (!isPricingFrequency(frequency)) {
    return fail(
      "INVALID_FREQUENCY",
      `Invalid frequency. Expected one of: ${PRICING_FREQUENCIES.join(", ")}.`,
    );
  }

  const addons = raw.addons ?? [];
  for (const addon of addons) {
    if (!isAddonSlug(addon)) {
      return fail(
        "UNKNOWN_ADDON",
        `Unknown add-on "${String(addon)}". Expected one of: ${ADDON_SLUGS.join(", ")}.`,
      );
    }
  }

  const teamSize = raw.teamSize ?? 1;
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > MAX_TEAM_SIZE) {
    return fail(
      "INVALID_TEAM_SIZE",
      `teamSize must be an integer between 1 and ${MAX_TEAM_SIZE}.`,
    );
  }

  const requestedTeamSize = raw.requestedTeamSize ?? 1;
  if (!Number.isInteger(requestedTeamSize) || (requestedTeamSize !== 1 && requestedTeamSize !== 2)) {
    return fail(
      "INVALID_REQUESTED_TEAM_SIZE",
      "requestedTeamSize must be 1 or 2.",
    );
  }
  if (raw.serviceSlug !== "regular-cleaning" && requestedTeamSize !== 1) {
    return fail(
      "INVALID_REQUESTED_TEAM_SIZE",
      "Team support requests are only available for regular cleaning.",
    );
  }

  if (raw.cleanerTenureMonths != null) {
    if (
      typeof raw.cleanerTenureMonths !== "number" ||
      !Number.isFinite(raw.cleanerTenureMonths) ||
      raw.cleanerTenureMonths < 0 ||
      raw.cleanerTenureMonths > 600
    ) {
      return fail(
        "INVALID_TENURE",
        "cleanerTenureMonths must be a non-negative number up to 600.",
      );
    }
  }

  return null;
}
