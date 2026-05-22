import {
  buildResolvedUserArea,
  clearCachedUserArea,
  FALLBACK_USER_AREA_LABEL,
  getCachedUserArea,
  setCachedUserArea,
  type ResolvedUserArea,
} from "./resolveUserArea";

const GEOLOCATION_TIMEOUT_MS = 12_000;

type GeolocationPosition = {
  coords: { latitude: number; longitude: number };
};

function getBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("GEOLOCATION_UNAVAILABLE"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: false,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 300_000,
      },
    );
  });
}

async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<ResolvedUserArea | null> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });

  const response = await fetch(`/api/geo/reverse?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    ok?: boolean;
    areaName?: string;
    displayLabel?: string;
  };

  if (!payload.ok || !payload.areaName || !payload.displayLabel) {
    return null;
  }

  return buildResolvedUserArea(payload.areaName);
}

/** Read cache, or detect suburb via geolocation + reverse geocode. Never persists coordinates. */
export async function detectUserArea(options?: {
  skipCache?: boolean;
}): Promise<ResolvedUserArea> {
  if (!options?.skipCache) {
    const cached = getCachedUserArea();
    if (cached) {
      return {
        areaName: cached.areaName,
        displayLabel: cached.displayLabel,
      };
    }
  }

  try {
    const position = await getBrowserPosition();
    const resolved = await reverseGeocodeCoordinates(
      position.coords.latitude,
      position.coords.longitude,
    );

    if (resolved && resolved.displayLabel !== FALLBACK_USER_AREA_LABEL) {
      setCachedUserArea(resolved);
      return resolved;
    }
  } catch {
    // Permission denied, timeout, or lookup failure. fall through to default.
  }

  return {
    areaName: "Cape Town",
    displayLabel: FALLBACK_USER_AREA_LABEL,
  };
}

/** Clear cached suburb and run detection again (e.g. “Use my current location”). */
export async function redetectUserArea(): Promise<ResolvedUserArea> {
  clearCachedUserArea();
  return detectUserArea({ skipCache: true });
}

/** Persist a manually chosen suburb using the same cache shape as geolocation. */
export function applyManualUserArea(areaName: string): ResolvedUserArea {
  const resolved = buildResolvedUserArea(areaName);
  if (resolved.displayLabel !== FALLBACK_USER_AREA_LABEL) {
    setCachedUserArea(resolved);
  }
  return resolved;
}
