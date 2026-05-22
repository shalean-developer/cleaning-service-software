import { resolveAreaSlug } from "@/features/locations/locationRegistry";

/** Normalize suburb/area input for matching against `cleaner_service_areas.area_slug`. */
export function normalizeAreaSlug(value: string): string {
  return resolveAreaSlug(value);
}
