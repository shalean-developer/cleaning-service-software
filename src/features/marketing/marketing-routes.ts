import { CAPE_TOWN_AREAS } from "./constants";
import { LOCATION_SEO_SLUG_LIST } from "./locationSlugList";

/** Lightweight route paths for marketing pages (safe for client imports). */
export const PRICING_PAGE_PATH = "/cleaning-prices-cape-town" as const;
export const ABOUT_PAGE_PATH = "/about" as const;
export const FAQ_PAGE_PATH = "/faq" as const;
export const CONTACT_PAGE_PATH = "/contact" as const;
export const REVIEWS_PAGE_PATH = "/reviews" as const;
export const LOCATIONS_HUB_PATH = "/locations" as const;
export const SERVICES_HUB_PATH = "/services" as const;
export const APPLY_PAGE_PATH = "/apply" as const;
export const APPLY_FORM_PAGE_PATH = "/apply/application-form" as const;

/** URL segment after `/locations/` (e.g. sea-point-cape-town). */
export type LocationSeoSlug = `${string}-cape-town`;

export function locationSlugFromArea(area: string): LocationSeoSlug {
  const slug = area.toLowerCase().replace(/\s+/g, "-");
  return `${slug}-cape-town` as LocationSeoSlug;
}

export const LOCATION_SEO_SLUGS = CAPE_TOWN_AREAS.map((area) =>
  locationSlugFromArea(area),
);

if (
  LOCATION_SEO_SLUGS.length !== LOCATION_SEO_SLUG_LIST.length ||
  !LOCATION_SEO_SLUGS.every((slug, i) => slug === LOCATION_SEO_SLUG_LIST[i])
) {
  throw new Error(
    "LOCATION_SEO_SLUG_LIST is out of sync with CAPE_TOWN_AREAS — update locationSlugList.ts",
  );
}
