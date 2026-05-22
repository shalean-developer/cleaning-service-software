import { findLocationByNameOrAlias } from "./locationRegistry";

export const USER_LOCATION_CACHE_KEY = "shalean_user_location";
export const USER_LOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const FALLBACK_USER_AREA_LABEL = "Cape Town, ZA";
export const DETECTING_USER_AREA_LABEL = "Detecting location…";

export type CachedUserArea = {
  areaName: string;
  displayLabel: string;
  cachedAt: number;
};

export type ResolvedUserArea = {
  areaName: string;
  displayLabel: string;
};

type NominatimAddress = Record<string, string>;

/** Prefer suburb-level fields; locality is late. OSM often puts electoral wards there. */
const AREA_FIELD_PRIORITY = [
  "suburb",
  "neighbourhood",
  "town",
  "village",
  "hamlet",
  "city_district",
  "locality",
  "city",
] as const;

const NOMINATIM_SKIP_FIELDS = new Set([
  "road",
  "house_number",
  "postcode",
  "country",
  "country_code",
  "state",
  "state_district",
  "region",
  "county",
  "ISO3166-2-lvl4",
  "iso3166-2-lvl4",
  "amenity",
  "footway",
  "building",
]);

const GENERIC_CITY_NAMES = new Set(
  ["cape town", "city of cape town", "city of cape town metropolitan municipality"].map(
    (s) => s.toLowerCase(),
  ),
);

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Reject electoral wards, municipalities, and other non-suburb admin labels. */
export function isUnusableGeocodeAreaName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  if (GENERIC_CITY_NAMES.has(lower)) return true;
  if (/\bward\s*\d+/i.test(trimmed)) return true;
  if (/\bcape town\s+ward\b/i.test(trimmed)) return true;
  if (/\belectoral\b/i.test(trimmed)) return true;
  if (/\bmunicipality\b/i.test(trimmed)) return true;
  if (/\bmetropolitan\b/i.test(trimmed)) return true;
  if (/\badministrative\b/i.test(trimmed)) return true;
  if (/\b(subdistrict|sub-district)\b/i.test(trimmed)) return true;
  if (/^city of\b/i.test(trimmed)) return true;
  if (/^\d+$/.test(trimmed)) return true;

  return false;
}

function collectGeocodeAreaCandidates(address: NominatimAddress): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const push = (value: string | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(trimmed);
  };

  for (const field of AREA_FIELD_PRIORITY) {
    push(address[field]);
  }

  for (const [field, value] of Object.entries(address)) {
    if (NOMINATIM_SKIP_FIELDS.has(field)) continue;
    if ((AREA_FIELD_PRIORITY as readonly string[]).includes(field)) continue;
    push(value);
  }

  return candidates;
}

export function pickAreaFromGeocodeAddress(
  address: NominatimAddress | null | undefined,
): string | null {
  if (!address) return null;

  const candidates = collectGeocodeAreaCandidates(address);

  for (const candidate of candidates) {
    if (isUnusableGeocodeAreaName(candidate)) continue;
    const match = findLocationByNameOrAlias(candidate);
    if (match) return match.name;
  }

  for (const candidate of candidates) {
    if (!isUnusableGeocodeAreaName(candidate)) return candidate;
  }

  return null;
}

/** Canonicalize free-text area names against the operational location registry. */
export function canonicalizeDetectedAreaName(rawArea: string): string {
  const trimmed = rawArea.trim();
  if (!trimmed) return trimmed;

  const match = findLocationByNameOrAlias(trimmed);
  return match?.name ?? trimmed;
}

/** Human-facing label: "{Area}, Cape Town" with safe fallbacks. */
export function formatUserAreaDisplay(areaName: string): string {
  const canonical = canonicalizeDetectedAreaName(areaName);
  const normalized = canonical.trim();

  if (!normalized || isUnusableGeocodeAreaName(normalized)) {
    return FALLBACK_USER_AREA_LABEL;
  }

  if (/,\s*cape town$/i.test(normalized)) {
    return normalized;
  }

  return `${normalized}, Cape Town`;
}

export function buildResolvedUserArea(areaName: string): ResolvedUserArea {
  const canonical = canonicalizeDetectedAreaName(areaName);
  return {
    areaName: canonical,
    displayLabel: formatUserAreaDisplay(canonical),
  };
}

export function parseNominatimReversePayload(payload: unknown): ResolvedUserArea | null {
  if (!payload || typeof payload !== "object") return null;

  const address = (payload as { address?: NominatimAddress }).address;
  const rawArea = pickAreaFromGeocodeAddress(address);
  if (!rawArea) return null;

  return buildResolvedUserArea(rawArea);
}

export function isCachedUserAreaValid(
  entry: CachedUserArea,
  nowMs = Date.now(),
): boolean {
  if (!entry.areaName?.trim() || !entry.displayLabel?.trim()) return false;
  if (isUnusableGeocodeAreaName(entry.areaName)) return false;
  if (/\bward\s*\d+/i.test(entry.displayLabel)) return false;
  if (!Number.isFinite(entry.cachedAt)) return false;
  return nowMs - entry.cachedAt < USER_LOCATION_CACHE_TTL_MS;
}

export function readCachedUserAreaPayload(raw: string): CachedUserArea | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CachedUserArea>;
    if (
      typeof parsed.areaName !== "string" ||
      typeof parsed.displayLabel !== "string" ||
      typeof parsed.cachedAt !== "number"
    ) {
      return null;
    }
    return {
      areaName: parsed.areaName,
      displayLabel: parsed.displayLabel,
      cachedAt: parsed.cachedAt,
    };
  } catch {
    return null;
  }
}

export function getCachedUserArea(): CachedUserArea | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(USER_LOCATION_CACHE_KEY);
    if (!raw) return null;

    const entry = readCachedUserAreaPayload(raw);
    if (!entry || !isCachedUserAreaValid(entry)) {
      window.localStorage.removeItem(USER_LOCATION_CACHE_KEY);
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

export function setCachedUserArea(resolved: ResolvedUserArea): void {
  if (!isBrowser()) return;

  const entry: CachedUserArea = {
    areaName: resolved.areaName,
    displayLabel: resolved.displayLabel,
    cachedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(USER_LOCATION_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Storage may be unavailable in private mode. detection still works for the session.
  }
}

export function clearCachedUserArea(): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.removeItem(USER_LOCATION_CACHE_KEY);
  } catch {
    // ignore
  }
}
