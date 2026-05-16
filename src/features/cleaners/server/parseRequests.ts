import { isServiceSlug } from "@/features/pricing/server/catalog";
import type { PricingInput, ServiceSlug } from "@/features/pricing/server/types";
import { DEFAULT_JOB_DURATION_MINUTES } from "./constants";
import { normalizeAreaSlug } from "./eligibility/normalize";
import { buildSlotFromDateAndTime } from "./eligibility/slot";
import type { BookingSlot, EligibilityQuery } from "./types";

export type ParsedAvailableRequest = {
  serviceSlug: ServiceSlug;
  areaSlug: string;
  slot: BookingSlot;
  teamSize: number;
  pricingInput?: PricingInput;
};

export type ParsedBookingCleanersRequest = ParsedAvailableRequest & {
  bookingId?: string;
  selectedCleanerId?: string | null;
  excludeBookingId?: string | null;
};

function readString(params: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function readNumber(params: Record<string, unknown>, key: string): number | undefined {
  const value = params[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function parseAvailableRequest(
  params: Record<string, unknown>,
): ParsedAvailableRequest | { error: string } {
  const serviceSlugRaw = readString(params, "serviceSlug", "service_slug");
  if (!serviceSlugRaw || !isServiceSlug(serviceSlugRaw)) {
    return { error: "serviceSlug is required and must be a known service." };
  }

  const areaRaw = readString(params, "areaSlug", "area_slug", "suburb", "area");
  if (!areaRaw) {
    return { error: "areaSlug or suburb is required." };
  }
  const areaSlug = normalizeAreaSlug(areaRaw);
  if (!areaSlug) {
    return { error: "areaSlug could not be normalized." };
  }

  const teamSize = readNumber(params, "teamSize") ?? readNumber(params, "team_size") ?? 1;
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 10) {
    return { error: "teamSize must be an integer between 1 and 10." };
  }

  let slot: BookingSlot | null = null;
  const scheduledStart = readString(params, "scheduledStart", "scheduled_start");
  const scheduledEnd = readString(params, "scheduledEnd", "scheduled_end");

  if (scheduledStart && scheduledEnd) {
    slot = { scheduledStart, scheduledEnd };
  } else {
    const date = readString(params, "date");
    const time = readString(params, "time");
    const duration =
      readNumber(params, "durationMinutes") ??
      readNumber(params, "duration_minutes") ??
      DEFAULT_JOB_DURATION_MINUTES;
    if (date && time) {
      slot = buildSlotFromDateAndTime(date, time, duration);
    }
  }

  if (!slot) {
    return {
      error:
        "Provide scheduledStart and scheduledEnd, or date and time (with optional durationMinutes).",
    };
  }

  const pricingInput = buildPricingInputFromParams(params, serviceSlugRaw);

  return {
    serviceSlug: serviceSlugRaw,
    areaSlug,
    slot,
    teamSize,
    pricingInput,
  };
}

export function parseBookingCleanersRequest(
  params: Record<string, unknown>,
): ParsedBookingCleanersRequest | { error: string } {
  const bookingId = readString(params, "bookingId", "booking_id");
  const selectedCleanerId =
    readString(params, "selectedCleanerId", "selected_cleaner_id", "preferredCleanerId") ??
    null;

  if (bookingId) {
    const serviceSlugRaw = readString(params, "serviceSlug", "service_slug");
    const serviceSlug =
      serviceSlugRaw && isServiceSlug(serviceSlugRaw)
        ? serviceSlugRaw
        : ("regular-cleaning" as ServiceSlug);

    const areaRaw = readString(params, "areaSlug", "area_slug", "suburb", "area");
    const areaSlug = areaRaw ? normalizeAreaSlug(areaRaw) : "unknown";

    const teamSize = readNumber(params, "teamSize") ?? readNumber(params, "team_size") ?? 1;

    const scheduledStart = readString(params, "scheduledStart", "scheduled_start");
    const scheduledEnd = readString(params, "scheduledEnd", "scheduled_end");
    const date = readString(params, "date");
    const time = readString(params, "time");

    let slot: BookingSlot = {
      scheduledStart: scheduledStart ?? new Date(0).toISOString(),
      scheduledEnd: scheduledEnd ?? new Date(3_600_000).toISOString(),
    };

    if (scheduledStart && scheduledEnd) {
      slot = { scheduledStart, scheduledEnd };
    } else if (date && time) {
      const built = buildSlotFromDateAndTime(
        date,
        time,
        readNumber(params, "durationMinutes") ?? DEFAULT_JOB_DURATION_MINUTES,
      );
      if (built) slot = built;
    }

    return {
      bookingId,
      selectedCleanerId,
      excludeBookingId: bookingId,
      serviceSlug,
      areaSlug,
      slot,
      teamSize,
      pricingInput: buildPricingInputFromParams(params, serviceSlug),
    };
  }

  const base = parseAvailableRequest(params);
  if ("error" in base) return base;

  return {
    ...base,
    selectedCleanerId,
  };
}

function buildPricingInputFromParams(
  params: Record<string, unknown>,
  serviceSlug: ServiceSlug,
): PricingInput | undefined {
  const bedrooms = readNumber(params, "bedrooms");
  const bathrooms = readNumber(params, "bathrooms");
  if (bedrooms == null || bathrooms == null) return undefined;

  return {
    serviceSlug,
    bedrooms,
    bathrooms,
    propertySizeSqm: readNumber(params, "propertySizeSqm") ?? readNumber(params, "property_size_sqm"),
    teamSize: readNumber(params, "teamSize") ?? readNumber(params, "team_size"),
    frequency:
      typeof params.frequency === "string"
        ? (params.frequency as PricingInput["frequency"])
        : undefined,
  };
}

export function extractQueryFromBookingMetadata(
  metadata: Record<string, unknown>,
  fallbackAreaSlug: string,
  slot: BookingSlot,
  teamSize: number,
): EligibilityQuery | null {
  const quote = metadata.quote;
  if (quote && typeof quote === "object" && !Array.isArray(quote)) {
    const input = (quote as Record<string, unknown>).input;
    if (input && typeof input === "object" && !Array.isArray(input)) {
      const serviceSlug = (input as Record<string, unknown>).serviceSlug;
      if (typeof serviceSlug === "string" && isServiceSlug(serviceSlug)) {
        const areaFromMeta = (metadata.areaSlug ?? metadata.suburb) as string | undefined;
        return {
          serviceSlug,
          areaSlug: areaFromMeta ? normalizeAreaSlug(String(areaFromMeta)) : fallbackAreaSlug,
          slot,
          teamSize,
        };
      }
    }
  }
  return null;
}

export function extractPricingInputFromBookingMetadata(
  metadata: Record<string, unknown>,
): PricingInput | undefined {
  const quote = metadata.quote;
  if (!quote || typeof quote !== "object" || Array.isArray(quote)) return undefined;
  const input = (quote as Record<string, unknown>).input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const raw = input as Record<string, unknown>;
  const serviceSlug = raw.serviceSlug;
  if (typeof serviceSlug !== "string" || !isServiceSlug(serviceSlug)) return undefined;
  if (typeof raw.bedrooms !== "number" || typeof raw.bathrooms !== "number") return undefined;

  return {
    serviceSlug,
    bedrooms: raw.bedrooms,
    bathrooms: raw.bathrooms,
    propertySizeSqm:
      typeof raw.propertySizeSqm === "number" ? raw.propertySizeSqm : undefined,
    frequency:
      typeof raw.frequency === "string"
        ? (raw.frequency as PricingInput["frequency"])
        : undefined,
    teamSize: typeof raw.teamSize === "number" ? raw.teamSize : undefined,
  };
}
