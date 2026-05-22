import { customerBookServicePath } from "./bookServiceRoute";
import {
  buildHeroQuoteLocationOptions,
  HERO_QUOTE_OTHER_LOCATION_LABEL,
} from "@/features/locations/heroQuoteLocationOptions";
import { isServiceSlug } from "@/features/pricing/server/catalog";
import type { ServiceSlug } from "@/features/pricing/server/types";
import type { BookingWizardState } from "./types";

export const PENDING_BOOKING_INTENT_STORAGE_KEY = "shalean_pending_booking_intent" as const;

const INTENT_VERSION = 1 as const;
const INTENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PendingBookingIntent = {
  version: typeof INTENT_VERSION;
  savedAt: string;
  serviceSlug: ServiceSlug;
  bedrooms: number;
  bathrooms: number;
  date: string;
  locationLabel: string;
  estimatedPriceCents: number;
  redirectTarget: string;
};

export type SavePendingBookingIntentInput = {
  serviceSlug: ServiceSlug;
  bedrooms: number;
  bathrooms: number;
  date: string;
  locationLabel: string;
  estimatedPriceCents: number;
};

export function buildPendingBookingRedirectTarget(serviceSlug: ServiceSlug): string {
  return customerBookServicePath(serviceSlug);
}

export function savePendingBookingIntent(input: SavePendingBookingIntentInput): void {
  if (typeof window === "undefined") return;

  const payload: PendingBookingIntent = {
    version: INTENT_VERSION,
    savedAt: new Date().toISOString(),
    serviceSlug: input.serviceSlug,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    date: input.date.trim(),
    locationLabel: input.locationLabel.trim(),
    estimatedPriceCents: input.estimatedPriceCents,
    redirectTarget: buildPendingBookingRedirectTarget(input.serviceSlug),
  };

  try {
    window.localStorage.setItem(PENDING_BOOKING_INTENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function loadPendingBookingIntent(): PendingBookingIntent | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PENDING_BOOKING_INTENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingBookingIntent>;
    if (parsed.version !== INTENT_VERSION) return null;
    if (!parsed.savedAt || typeof parsed.serviceSlug !== "string" || !isServiceSlug(parsed.serviceSlug)) {
      return null;
    }
    if (typeof parsed.bedrooms !== "number" || typeof parsed.bathrooms !== "number") return null;
    if (typeof parsed.date !== "string" || typeof parsed.locationLabel !== "string") return null;
    if (typeof parsed.estimatedPriceCents !== "number") return null;
    if (typeof parsed.redirectTarget !== "string") return null;

    const savedAtMs = Date.parse(parsed.savedAt);
    if (Number.isNaN(savedAtMs) || Date.now() - savedAtMs > INTENT_MAX_AGE_MS) {
      clearPendingBookingIntent();
      return null;
    }

    return parsed as PendingBookingIntent;
  } catch {
    return null;
  }
}

export function clearPendingBookingIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_BOOKING_INTENT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Consumes a stored intent when it matches the active booking route service. */
export function consumePendingBookingIntentForService(
  serviceSlug: ServiceSlug,
): PendingBookingIntent | null {
  const intent = loadPendingBookingIntent();
  if (!intent || intent.serviceSlug !== serviceSlug) return null;
  clearPendingBookingIntent();
  return intent;
}

/** Maps hero quote location labels to wizard suburb/city fields. */
export function heroQuoteLocationToWizardAddress(locationLabel: string): {
  suburb: string;
  city: string;
} {
  const trimmed = locationLabel.trim();
  if (!trimmed || trimmed === HERO_QUOTE_OTHER_LOCATION_LABEL) {
    return { suburb: "", city: "Cape Town" };
  }

  const options = buildHeroQuoteLocationOptions();
  const match = options.find((option) => option.value === trimmed || option.label === trimmed);
  if (match?.areaName) {
    return { suburb: match.areaName, city: "Cape Town" };
  }

  const commaIndex = trimmed.lastIndexOf(",");
  if (commaIndex > 0) {
    const suburb = trimmed.slice(0, commaIndex).trim();
    const city = trimmed.slice(commaIndex + 1).trim();
    return { suburb, city: city || "Cape Town" };
  }

  return { suburb: trimmed, city: "Cape Town" };
}

export function applyPendingBookingIntentToWizardState(
  state: BookingWizardState,
  intent: PendingBookingIntent,
): BookingWizardState {
  const { suburb, city } = heroQuoteLocationToWizardAddress(intent.locationLabel);
  const hasDate = intent.date.length > 0;

  return {
    ...state,
    serviceSlug: intent.serviceSlug,
    bedrooms: intent.bedrooms,
    bathrooms: intent.bathrooms,
    date: intent.date,
    suburb,
    city,
    step: hasDate ? "datetime" : state.step,
  };
}
