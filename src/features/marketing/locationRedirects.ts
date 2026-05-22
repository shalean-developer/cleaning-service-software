import type { Redirect } from "next/dist/lib/load-custom-routes";
import { LOCATION_SEO_SLUG_LIST } from "./locationSlugList";

/** Legacy path without the `-cape-town` suffix (e.g. `/locations/sea-point`). */
export function legacyLocationPathFromSlug(slug: string): string {
  const segment = slug.replace(/-cape-town$/, "");
  return `/locations/${segment}`;
}

/**
 * Permanent redirects from short legacy suburb URLs to canonical `-cape-town` slugs.
 * Generated from LOCATION_SEO_SLUGS. do not hardcode individual suburbs.
 */
export function buildLocationLegacyRedirects(): Redirect[] {
  return LOCATION_SEO_SLUG_LIST.map((slug) => ({
    source: legacyLocationPathFromSlug(slug),
    destination: `/locations/${slug}`,
    permanent: true,
  }));
}
