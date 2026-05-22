import { LOCATION_SEO_CONTENT } from "./seo-pages";
import type { LocationSeoSlug } from "./marketing-routes";
import { LOCATION_SEO_SLUGS } from "./marketing-routes";

/** Geographic neighbors for internal topical clustering (3–5 per suburb). */
export const LOCATION_NEARBY_BY_SLUG: Record<LocationSeoSlug, readonly LocationSeoSlug[]> = {
  "sea-point-cape-town": [
    "green-point-cape-town",
    "camps-bay-cape-town",
    "claremont-cape-town",
  ],
  "green-point-cape-town": [
    "sea-point-cape-town",
    "camps-bay-cape-town",
    "claremont-cape-town",
  ],
  "camps-bay-cape-town": [
    "sea-point-cape-town",
    "green-point-cape-town",
    "claremont-cape-town",
  ],
  "claremont-cape-town": [
    "rondebosch-cape-town",
    "wynberg-cape-town",
    "observatory-cape-town",
    "sea-point-cape-town",
  ],
  "rondebosch-cape-town": [
    "claremont-cape-town",
    "observatory-cape-town",
    "wynberg-cape-town",
  ],
  "wynberg-cape-town": [
    "claremont-cape-town",
    "rondebosch-cape-town",
    "observatory-cape-town",
  ],
  "observatory-cape-town": [
    "rondebosch-cape-town",
    "claremont-cape-town",
    "wynberg-cape-town",
  ],
  "century-city-cape-town": [
    "milnerton-cape-town",
    "bellville-cape-town",
    "table-view-cape-town",
  ],
  "bellville-cape-town": [
    "durbanville-cape-town",
    "century-city-cape-town",
    "table-view-cape-town",
  ],
  "durbanville-cape-town": [
    "bellville-cape-town",
    "table-view-cape-town",
    "century-city-cape-town",
  ],
  "table-view-cape-town": [
    "milnerton-cape-town",
    "bellville-cape-town",
    "durbanville-cape-town",
  ],
  "milnerton-cape-town": [
    "table-view-cape-town",
    "century-city-cape-town",
    "green-point-cape-town",
  ],
};

export type NearbyLocationLink = {
  slug: LocationSeoSlug;
  area: string;
  path: string;
  label: string;
};

export function getNearbyLocationLinks(slug: LocationSeoSlug): NearbyLocationLink[] {
  const nearbySlugs = LOCATION_NEARBY_BY_SLUG[slug] ?? [];
  const links: NearbyLocationLink[] = [];
  for (const nearby of nearbySlugs) {
    if (nearby === slug) continue;
    const content = LOCATION_SEO_CONTENT[nearby];
    if (!content) continue;
    links.push({
      slug: nearby,
      area: content.area,
      path: content.path,
      label: cleaningServicesInAreaLabel(content.area),
    });
  }
  return links;
}

export function cleaningServicesInAreaLabel(area: string): string {
  return `Cleaning services in ${area}`;
}

/** Shorter chip-friendly label when space is tight. */
export function cleaningServicesInAreaShortLabel(area: string): string {
  return `${area} cleaning`;
}

/** Ensures every canonical slug has a nearby map entry (build-time guard). */
export function assertLocationNearbyMapComplete(): void {
  for (const slug of LOCATION_SEO_SLUGS) {
    const nearby = LOCATION_NEARBY_BY_SLUG[slug as LocationSeoSlug];
    if (!nearby?.length) {
      throw new Error(`Missing nearby areas for location slug: ${slug}`);
    }
    if (nearby.includes(slug as LocationSeoSlug)) {
      throw new Error(`Nearby map must not self-link: ${slug}`);
    }
  }
}
