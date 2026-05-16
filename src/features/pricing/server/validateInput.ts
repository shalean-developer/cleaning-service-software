import {
  ADDON_SLUGS,
  PRICING_FREQUENCIES,
  SERVICE_SLUGS,
  type PricingInput,
  type PricingQuoteFailure,
} from "./types";
import {
  isAddonSlug,
  isPricingFrequency,
  isServiceSlug,
  SERVICE_CATALOG,
} from "./catalog";

const MAX_ROOMS = 20;
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
