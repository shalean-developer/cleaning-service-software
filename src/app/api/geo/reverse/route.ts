import { NextResponse } from "next/server";
import { SHALEAN_CONTACT } from "@/features/marketing/contact";
import {
  buildResolvedUserArea,
  parseNominatimReversePayload,
} from "@/features/locations/resolveUserArea";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

/**
 * Reverse-geocode coordinates to suburb/locality only.
 * Coordinates are not logged or stored. response contains area labels only.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseCoordinate(searchParams.get("lat"), -90, 90);
  const lng = parseCoordinate(searchParams.get("lng"), -180, 180);

  if (lat == null || lng == null) {
    return NextResponse.json(
      { ok: false, error: "INVALID_COORDINATES", message: "lat and lng are required." },
      { status: 400 },
    );
  }

  const nominatimUrl = new URL(NOMINATIM_REVERSE_URL);
  nominatimUrl.searchParams.set("format", "json");
  nominatimUrl.searchParams.set("lat", String(lat));
  nominatimUrl.searchParams.set("lon", String(lng));
  nominatimUrl.searchParams.set("zoom", "16");
  nominatimUrl.searchParams.set("addressdetails", "1");

  let payload: unknown;
  try {
    const response = await fetch(nominatimUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": `ShaleanCleaning/1.0 (${SHALEAN_CONTACT.email})`,
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "GEOCODE_FAILED", message: "Reverse geocode failed." },
        { status: 502 },
      );
    }

    payload = await response.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "GEOCODE_UNAVAILABLE", message: "Reverse geocode unavailable." },
      { status: 502 },
    );
  }

  const parsed = parseNominatimReversePayload(payload);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: "AREA_NOT_FOUND", message: "No suburb or locality found." },
      { status: 404 },
    );
  }

  const resolved = buildResolvedUserArea(parsed.areaName);

  return NextResponse.json({
    ok: true,
    areaName: resolved.areaName,
    displayLabel: resolved.displayLabel,
  });
}
