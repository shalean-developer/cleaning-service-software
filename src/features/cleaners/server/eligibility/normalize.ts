/** Normalize suburb/area input for matching against `cleaner_service_areas.area_slug`. */
export function normalizeAreaSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
