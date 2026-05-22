/**
 * Canonical location SEO slugs — no imports from pricing/catalog (safe for next.config).
 * Must stay aligned with CAPE_TOWN_AREAS in constants.ts.
 */
export const LOCATION_SEO_SLUG_LIST = [
  "sea-point-cape-town",
  "claremont-cape-town",
  "camps-bay-cape-town",
  "century-city-cape-town",
  "bellville-cape-town",
  "durbanville-cape-town",
  "table-view-cape-town",
  "observatory-cape-town",
  "rondebosch-cape-town",
  "wynberg-cape-town",
  "green-point-cape-town",
  "milnerton-cape-town",
] as const;

export type LocationSeoSlugFromList = (typeof LOCATION_SEO_SLUG_LIST)[number];
